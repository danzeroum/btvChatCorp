use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{extractors::WorkspaceContext, state::AppState};

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route("/projects", get(list_projects).post(create_project))
        .route("/projects/:id", get(get_project).put(update_project).delete(delete_project))
        .route("/projects/:id/documents", post(link_document))
        .route("/projects/:id/documents/:doc_id", delete(unlink_document))
        .route("/projects/:id/members", get(list_members).post(add_member))
        .route("/projects/:id/members/:user_id", delete(remove_member))
        .route("/projects/:id/instructions", get(list_instructions).post(create_instruction))
        .route("/projects/:id/instructions/:instr_id", put(update_instruction).delete(delete_instruction))
        .route("/projects/:id/stats", get(get_project_stats))
}

// ─── Request / Response structs ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct LinkDocumentRequest {
    pub document_id: Uuid,
    pub folder: Option<String>,
    pub notes: Option<String>,
    pub is_pinned: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateInstructionRequest {
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub trigger_mode: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub status: String,
    pub category: Option<String>,
    pub priority: String,
    pub tags: Vec<String>,
    pub created_by: Uuid,
    pub created_at: String,
    pub updated_at: String,
    pub last_activity_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectStatsResponse {
    pub project_id: Uuid,
    pub total_chats: i64,
    pub total_documents: i64,
    pub total_messages: i64,
    pub documents_processed: i64,
    pub last_chat_at: Option<String>,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

pub async fn list_projects(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
) -> Result<Json<Vec<ProjectResponse>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT id, name, description, icon, color, status, category,
               priority, tags, created_by, created_at, updated_at, last_activity_at
        FROM projects
        WHERE workspace_id = $1
        ORDER BY last_activity_at DESC NULLS LAST
        "#,
        ctx.workspace_id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| ProjectResponse {
                id: r.id,
                name: r.name,
                description: r.description,
                icon: r.icon,
                color: r.color,
                status: r.status,
                category: r.category,
                priority: r.priority,
                tags: r.tags,
                created_by: r.created_by,
                created_at: r.created_at.to_rfc3339(),
                updated_at: r.updated_at.to_rfc3339(),
                last_activity_at: r.last_activity_at.map(|t| t.to_rfc3339()),
            })
            .collect(),
    ))
}

pub async fn create_project(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Json(req): Json<CreateProjectRequest>,
) -> Result<(StatusCode, Json<ProjectResponse>), StatusCode> {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();
    let tags = req.tags.unwrap_or_default();

    sqlx::query!(
        r#"
        INSERT INTO projects
            (id, workspace_id, name, description, icon, color,
             status, category, priority, tags, created_by, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$11)
        "#,
        id, ctx.workspace_id, req.name, req.description,
        req.icon, req.color, req.category,
        req.priority.as_deref().unwrap_or("medium"),
        &tags, ctx.user_id, now,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(ProjectResponse {
        id,
        name: req.name,
        description: req.description,
        icon: req.icon,
        color: req.color,
        status: "active".into(),
        category: req.category,
        priority: req.priority.unwrap_or_else(|| "medium".into()),
        tags,
        created_by: ctx.user_id,
        created_at: now.to_rfc3339(),
        updated_at: now.to_rfc3339(),
        last_activity_at: None,
    })))
}

pub async fn get_project(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProjectResponse>, StatusCode> {
    let r = sqlx::query!(
        r#"
        SELECT id, name, description, icon, color, status, category,
               priority, tags, created_by, created_at, updated_at, last_activity_at
        FROM projects WHERE id = $1 AND workspace_id = $2
        "#,
        id, ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(ProjectResponse {
        id: r.id, name: r.name, description: r.description,
        icon: r.icon, color: r.color, status: r.status,
        category: r.category, priority: r.priority, tags: r.tags,
        created_by: r.created_by,
        created_at: r.created_at.to_rfc3339(),
        updated_at: r.updated_at.to_rfc3339(),
        last_activity_at: r.last_activity_at.map(|t| t.to_rfc3339()),
    }))
}

pub async fn update_project(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>, StatusCode> {
    let r = sqlx::query!(
        r#"
        UPDATE projects SET
            name = COALESCE($3, name),
            description = COALESCE($4, description),
            icon = COALESCE($5, icon),
            color = COALESCE($6, color),
            status = COALESCE($7, status),
            category = COALESCE($8, category),
            priority = COALESCE($9, priority),
            tags = COALESCE($10, tags),
            updated_at = NOW()
        WHERE id = $1 AND workspace_id = $2
        RETURNING id, name, description, icon, color, status, category,
                  priority, tags, created_by, created_at, updated_at, last_activity_at
        "#,
        id, ctx.workspace_id,
        req.name, req.description, req.icon, req.color,
        req.status, req.category, req.priority,
        req.tags.as_deref(),
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(ProjectResponse {
        id: r.id, name: r.name, description: r.description,
        icon: r.icon, color: r.color, status: r.status,
        category: r.category, priority: r.priority, tags: r.tags,
        created_by: r.created_by,
        created_at: r.created_at.to_rfc3339(),
        updated_at: r.updated_at.to_rfc3339(),
        last_activity_at: r.last_activity_at.map(|t| t.to_rfc3339()),
    }))
}

pub async fn delete_project(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM projects WHERE id = $1 AND workspace_id = $2",
        id, ctx.workspace_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 { return Err(StatusCode::NOT_FOUND); }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn link_document(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<LinkDocumentRequest>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        INSERT INTO project_documents
            (id, project_id, document_id, folder, notes, is_pinned, linked_by)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        ON CONFLICT (project_id, document_id) DO NOTHING
        "#,
        id, req.document_id, req.folder, req.notes,
        req.is_pinned.unwrap_or(false), ctx.user_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::CREATED)
}

pub async fn unlink_document(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path((project_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        "DELETE FROM project_documents WHERE project_id = $1 AND document_id = $2",
        project_id, doc_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_members(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT pm.user_id, pm.role, u.name, u.email
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = $1
        "#,
        id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(rows.into_iter().map(|r| serde_json::json!({
        "user_id": r.user_id,
        "name": r.name,
        "email": r.email,
        "role": r.role,
    })).collect()))
}

pub async fn add_member(
    _ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<AddMemberRequest>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3
        "#,
        id, req.user_id, req.role,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::CREATED)
}

pub async fn remove_member(
    _ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path((project_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2",
        project_id, user_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_instructions(
    _ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT id, name, description, content, trigger_mode, is_active, created_at
        FROM project_instructions WHERE project_id = $1
        ORDER BY created_at ASC
        "#,
        id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(rows.into_iter().map(|r| serde_json::json!({
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "content": r.content,
        "trigger_mode": r.trigger_mode,
        "is_active": r.is_active,
        "created_at": r.created_at.to_rfc3339(),
    })).collect()))
}

pub async fn create_instruction(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<CreateInstructionRequest>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        INSERT INTO project_instructions
            (id, project_id, name, description, content, trigger_mode, is_active, created_by)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, $6)
        "#,
        id, req.name, req.description, req.content,
        req.trigger_mode.as_deref().unwrap_or("always"),
        ctx.user_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::CREATED)
}

pub async fn update_instruction(
    _ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path((_proj_id, instr_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<CreateInstructionRequest>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        UPDATE project_instructions
        SET name=$1, content=$2, description=$3, updated_at=NOW()
        WHERE id=$4
        "#,
        req.name, req.content, req.description, instr_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

pub async fn delete_instruction(
    _ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path((_proj_id, instr_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!("DELETE FROM project_instructions WHERE id = $1", instr_id)
        .execute(&app.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_project_stats(
    _ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProjectStatsResponse>, StatusCode> {
    let stats = sqlx::query!(
        r#"
        SELECT
            (SELECT COUNT(*) FROM project_chats WHERE project_id = $1)       AS total_chats,
            (SELECT COUNT(*) FROM project_documents WHERE project_id = $1)    AS total_documents,
            (SELECT COUNT(*) FROM chat_messages cm
             JOIN project_chats pc ON pc.chat_id = cm.chat_id
             WHERE pc.project_id = $1)                                        AS total_messages,
            (SELECT COUNT(*) FROM project_documents pd
             JOIN documents d ON d.id = pd.document_id
             WHERE pd.project_id = $1 AND d.processing_status = 'indexed')   AS documents_processed,
            (SELECT MAX(created_at) FROM project_chats WHERE project_id = $1) AS last_chat_at
        "#,
        id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ProjectStatsResponse {
        project_id: id,
        total_chats: stats.total_chats.unwrap_or(0),
        total_documents: stats.total_documents.unwrap_or(0),
        total_messages: stats.total_messages.unwrap_or(0),
        documents_processed: stats.documents_processed.unwrap_or(0),
        last_chat_at: stats.last_chat_at.map(|t| t.to_rfc3339()),
    }))
}
