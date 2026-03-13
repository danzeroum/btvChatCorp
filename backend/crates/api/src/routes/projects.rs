use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::project::{CreateProjectDto, Project, UpdateProjectDto},
    state::AppState,
};

// Type alias para evitar type_complexity no clippy
type InstructionRow = (
    Uuid,
    String,
    Option<String>,
    String,
    String,
    bool,
    chrono::DateTime<chrono::Utc>,
);

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects", get(list).post(create))
        .route("/projects/:id", get(get_one).put(update).delete(remove))
        .route(
            "/projects/:id/instructions",
            get(list_instructions).post(create_instruction),
        )
        .route(
            "/projects/:id/instructions/:iid",
            put(update_instruction).delete(delete_instruction),
        )
        .route("/projects/:id/stats", get(stats))
}

async fn list(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Project>>, AppError> {
    let rows = sqlx::query_as::<_, Project>(
        "SELECT id,workspace_id,name,description,icon,color,status,category,priority,tags,
                created_by,last_activity_at,created_at,updated_at
         FROM projects WHERE workspace_id=$1 ORDER BY last_activity_at DESC NULLS LAST",
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
        "INSERT INTO projects (workspace_id,name,description,icon,color,category,priority,tags,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
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
        "SELECT * FROM projects WHERE id=$1 AND workspace_id=$2",
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
        "UPDATE projects SET
            name=COALESCE($3,name), description=COALESCE($4,description),
            icon=COALESCE($5,icon), color=COALESCE($6,color),
            status=COALESCE($7,status), category=COALESCE($8,category),
            priority=COALESCE($9,priority), tags=COALESCE($10,tags),
            updated_at=NOW()
         WHERE id=$1 AND workspace_id=$2 RETURNING *",
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
    let r = sqlx::query("DELETE FROM projects WHERE id=$1 AND workspace_id=$2")
        .bind(id)
        .bind(auth.workspace_id)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;
    if r.rows_affected() == 0 {
        return Err(AppError::not_found("Projeto nao encontrado"));
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn stats(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("SELECT id FROM projects WHERE id=$1 AND workspace_id=$2")
        .bind(id)
        .bind(auth.workspace_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::not_found("Projeto nao encontrado"))?;

    let total_chats: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM chats WHERE project_id=$1")
            .bind(id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));
    let total_docs: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM project_documents WHERE project_id=$1")
            .bind(id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));
    let total_msgs: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM messages m JOIN chats c ON c.id=m.chat_id WHERE c.project_id=$1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    Ok(Json(serde_json::json!({
        "project_id":      id,
        "total_chats":     total_chats.0,
        "total_documents": total_docs.0,
        "total_messages":  total_msgs.0,
    })))
}

#[derive(serde::Deserialize)]
struct InstructionDto {
    name: String,
    content: String,
    description: Option<String>,
    trigger_mode: Option<String>,
    is_active: Option<bool>,
}

async fn list_instructions(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    sqlx::query("SELECT id FROM projects WHERE id=$1 AND workspace_id=$2")
        .bind(id)
        .bind(auth.workspace_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::not_found("Projeto nao encontrado"))?;

    let rows: Vec<InstructionRow> = sqlx::query_as(
        "SELECT id,name,description,content,trigger_mode,is_active,created_at
         FROM project_instructions WHERE project_id=$1 ORDER BY created_at",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|(id, name, desc, content, trigger, active, created)| {
                serde_json::json!({
                    "id": id, "name": name, "description": desc,
                    "content": content, "trigger_mode": trigger,
                    "is_active": active, "created_at": created.to_rfc3339(),
                })
            })
            .collect(),
    ))
}

async fn create_instruction(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(dto): Json<InstructionDto>,
) -> Result<StatusCode, AppError> {
    sqlx::query(
        "INSERT INTO project_instructions (project_id,name,description,content,trigger_mode,is_active,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)",
    )
    .bind(id)
    .bind(&dto.name)
    .bind(&dto.description)
    .bind(&dto.content)
    .bind(dto.trigger_mode.as_deref().unwrap_or("always"))
    .bind(dto.is_active.unwrap_or(true))
    .bind(auth.user_id)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;
    Ok(StatusCode::CREATED)
}

async fn update_instruction(
    _auth: Extension<AuthUser>,
    State(state): State<AppState>,
    Path((_pid, iid)): Path<(Uuid, Uuid)>,
    Json(dto): Json<InstructionDto>,
) -> Result<StatusCode, AppError> {
    sqlx::query(
        "UPDATE project_instructions SET name=$1,content=$2,description=$3,trigger_mode=$4,is_active=$5,updated_at=NOW() WHERE id=$6",
    )
    .bind(&dto.name)
    .bind(&dto.content)
    .bind(&dto.description)
    .bind(dto.trigger_mode.as_deref().unwrap_or("always"))
    .bind(dto.is_active.unwrap_or(true))
    .bind(iid)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;
    Ok(StatusCode::OK)
}

async fn delete_instruction(
    _auth: Extension<AuthUser>,
    State(state): State<AppState>,
    Path((_pid, iid)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM project_instructions WHERE id=$1")
        .bind(iid)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;
    Ok(StatusCode::NO_CONTENT)
}
