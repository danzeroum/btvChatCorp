use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::project::{CreateProjectDto, Project, UpdateProjectDto},
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects",                   get(list).post(create))
        .route("/projects/:id",               get(get_one).put(update).delete(remove))
        .route("/projects/:id/instructions",  get(list_instructions).post(create_instruction))
        .route("/projects/:id/instructions/:iid", put(update_instruction).delete(delete_instruction))
        .route("/projects/:id/stats",         get(stats))
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async fn list(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Project>>, AppError> {
    let rows = sqlx::query_as::<_, Project>(
        r#"
        SELECT id, workspace_id, name, description, icon, color, status,
               category, priority, tags, created_by, last_activity_at, created_at, updated_at
        FROM projects
        WHERE workspace_id = $1
        ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
        "#,
    )
    .bind(auth.workspace_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

async fn create(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Json(dto): Json<CreateProjectDto>,
) -> Result<(StatusCode, Json<Project>), AppError> {
    let tags = dto.tags.unwrap_or_default();
    let row = sqlx::query_as::<_, Project>(
        r#"
        INSERT INTO projects
            (workspace_id, name, description, icon, color, category, priority, tags, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        "#,
    )
    .bind(auth.workspace_id)
    .bind(&dto.name)
    .bind(&dto.description)
    .bind(dto.icon.as_deref().unwrap_or("📁"))
    .bind(dto.color.as_deref().unwrap_or("#6366f1"))
    .bind(&dto.category)
    .bind(dto.priority.as_deref().unwrap_or("medium"))
    .bind(&tags)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;
    Ok((StatusCode::CREATED, Json(row)))
}

async fn get_one(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, AppError> {
    let row = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND workspace_id = $2",
    )
    .bind(id)
    .bind(auth.workspace_id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

async fn update(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateProjectDto>,
) -> Result<Json<Project>, AppError> {
    let row = sqlx::query_as::<_, Project>(
        r#"
        UPDATE projects SET
            name        = COALESCE($3, name),
            description = COALESCE($4, description),
            icon        = COALESCE($5, icon),
            color       = COALESCE($6, color),
            status      = COALESCE($7, status),
            category    = COALESCE($8, category),
            priority    = COALESCE($9, priority),
            tags        = COALESCE($10, tags),
            updated_at  = NOW()
        WHERE id = $1 AND workspace_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(auth.workspace_id)
    .bind(&dto.name)
    .bind(&dto.description)
    .bind(&dto.icon)
    .bind(&dto.color)
    .bind(&dto.status)
    .bind(&dto.category)
    .bind(&dto.priority)
    .bind(dto.tags.as_deref())
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

async fn remove(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let r = sqlx::query!(
        "DELETE FROM projects WHERE id = $1 AND workspace_id = $2",
        id, auth.workspace_id,
    )
    .execute(&state.db)
    .await?;
    if r.rows_affected() == 0 { return Err(AppError::not_found("Projeto não encontrado")); }
    Ok(StatusCode::NO_CONTENT)
}

async fn stats(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Garante que o projeto pertence ao workspace
    sqlx::query!("SELECT id FROM projects WHERE id=$1 AND workspace_id=$2", id, auth.workspace_id)
        .fetch_one(&state.db).await
        .map_err(|_| AppError::not_found("Projeto não encontrado"))?;

    let s = sqlx::query!(
        r#"
        SELECT
            (SELECT COUNT(*) FROM chats      WHERE project_id=$1)::bigint AS total_chats,
            (SELECT COUNT(*) FROM project_documents WHERE project_id=$1)::bigint AS total_docs,
            (SELECT COUNT(*) FROM messages m JOIN chats c ON c.id=m.chat_id WHERE c.project_id=$1)::bigint AS total_messages
        "#,
        id,
    )
    .fetch_one(&state.db).await?;

    Ok(Json(serde_json::json!({
        "project_id":     id,
        "total_chats":    s.total_chats.unwrap_or(0),
        "total_documents":s.total_docs.unwrap_or(0),
        "total_messages": s.total_messages.unwrap_or(0),
    })))
}

// ─── Instructions ─────────────────────────────────────────────────────────────

async fn list_instructions(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    // Verifica acesso
    sqlx::query!("SELECT id FROM projects WHERE id=$1 AND workspace_id=$2", id, auth.workspace_id)
        .fetch_one(&state.db).await
        .map_err(|_| AppError::not_found("Projeto não encontrado"))?;

    let rows = sqlx::query!(
        r#"
        SELECT id, name, description, content, trigger_mode, is_active, created_at
        FROM project_instructions WHERE project_id=$1 ORDER BY created_at
        "#,
        id,
    )
    .fetch_all(&state.db).await?;

    Ok(Json(rows.into_iter().map(|r| serde_json::json!({
        "id":           r.id,
        "name":         r.name,
        "description":  r.description,
        "content":      r.content,
        "trigger_mode": r.trigger_mode,
        "is_active":    r.is_active,
        "created_at":   r.created_at.to_rfc3339(),
    })).collect()))
}

#[derive(serde::Deserialize)]
struct InstructionDto {
    name:         String,
    content:      String,
    description:  Option<String>,
    trigger_mode: Option<String>,
    is_active:    Option<bool>,
}

async fn create_instruction(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(dto): Json<InstructionDto>,
) -> Result<StatusCode, AppError> {
    sqlx::query!(
        r#"
        INSERT INTO project_instructions
            (project_id, name, description, content, trigger_mode, is_active, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        "#,
        id, dto.name, dto.description, dto.content,
        dto.trigger_mode.as_deref().unwrap_or("always"),
        dto.is_active.unwrap_or(true),
        auth.user_id,
    )
    .execute(&state.db).await?;
    Ok(StatusCode::CREATED)
}

async fn update_instruction(
    _auth: Extension<AuthUser>,
    State(state): State<AppState>,
    Path((_pid, iid)): Path<(Uuid, Uuid)>,
    Json(dto): Json<InstructionDto>,
) -> Result<StatusCode, AppError> {
    sqlx::query!(
        "UPDATE project_instructions SET name=$1,content=$2,description=$3,trigger_mode=$4,is_active=$5,updated_at=NOW() WHERE id=$6",
        dto.name, dto.content, dto.description,
        dto.trigger_mode.as_deref().unwrap_or("always"),
        dto.is_active.unwrap_or(true),
        iid,
    )
    .execute(&state.db).await?;
    Ok(StatusCode::OK)
}

async fn delete_instruction(
    _auth: Extension<AuthUser>,
    State(state): State<AppState>,
    Path((_pid, iid)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    sqlx::query!("DELETE FROM project_instructions WHERE id=$1", iid)
        .execute(&state.db).await?;
    Ok(StatusCode::NO_CONTENT)
}
