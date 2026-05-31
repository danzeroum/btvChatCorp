//! CRUD de projetos da API Pública.
//!
//! Diferente do crate `api` (que autentica por JWT e usa `AuthUser`), aqui a
//! autenticação é por API key (`ApiKeyContext`). Como `projects.created_by` é
//! `NOT NULL REFERENCES users(id)`, usamos o dono da API key
//! (`api_keys.created_by`, exposto como `ctx.user_id`) como autor do projeto —
//! foi isso que desbloqueou o TODO `C2-writes`. Os SQL espelham os handlers
//! vivos de `crate_api::routes::projects`, sempre isolados por `workspace_id`.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, put},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::api_key::{require_permission, ApiKeyContext},
};
use crate_api::models::project::{CreateProjectDto, Project, UpdateProjectDto};
use crate_api::state::AppState;

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route("/projects", get(list).post(create))
        .route("/projects/:id", put(update).delete(remove))
}

/// Mapeia erros do sqlx para o formato de erro da API Pública.
fn db_err(e: sqlx::Error) -> ApiError {
    match e {
        sqlx::Error::RowNotFound => ApiError::new("not_found", "Projeto nao encontrado"),
        other => ApiError::new("internal_error", other.to_string()),
    }
}

/// GET /api/v1/projects — lista os projetos do workspace da API key.
async fn list(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
) -> Result<Json<Vec<Project>>, ApiError> {
    require_permission(&ctx, "projects", "read")?;
    let rows = sqlx::query_as::<_, Project>(
        "SELECT id,workspace_id,name,description,icon,color,status,category,priority,tags,
                created_by,last_activity_at,created_at,updated_at
         FROM projects WHERE workspace_id=$1 ORDER BY last_activity_at DESC NULLS LAST",
    )
    .bind(ctx.workspace_id)
    .fetch_all(&app.db)
    .await
    .map_err(db_err)?;
    Ok(Json(rows))
}

/// POST /api/v1/projects — cria um projeto com `created_by` = dono da API key.
async fn create(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Json(dto): Json<CreateProjectDto>,
) -> Result<(StatusCode, Json<Project>), ApiError> {
    require_permission(&ctx, "projects", "write")?;

    let created_by = ctx.user_id.ok_or_else(|| {
        ApiError::new(
            "no_owner",
            "API key has no owner user; cannot set created_by",
        )
    })?;

    let tags = dto.tags.unwrap_or_default();
    let row = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (workspace_id,name,description,icon,color,category,priority,tags,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    )
    .bind(ctx.workspace_id)
    .bind(&dto.name)
    .bind(&dto.description)
    .bind(dto.icon.as_deref().unwrap_or("📁"))
    .bind(dto.color.as_deref().unwrap_or("#6366f1"))
    .bind(&dto.category)
    .bind(dto.priority.as_deref().unwrap_or("medium"))
    .bind(&tags)
    .bind(created_by)
    .fetch_one(&app.db)
    .await
    .map_err(db_err)?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// PUT /api/v1/projects/:id — atualiza um projeto do workspace da API key.
async fn update(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateProjectDto>,
) -> Result<Json<Project>, ApiError> {
    require_permission(&ctx, "projects", "write")?;
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
    .bind(ctx.workspace_id)
    .bind(&dto.name)
    .bind(&dto.description)
    .bind(&dto.icon)
    .bind(&dto.color)
    .bind(&dto.status)
    .bind(&dto.category)
    .bind(&dto.priority)
    .bind(dto.tags.as_deref())
    .fetch_one(&app.db)
    .await
    .map_err(db_err)?;
    Ok(Json(row))
}

/// DELETE /api/v1/projects/:id — remove um projeto do workspace da API key.
async fn remove(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    require_permission(&ctx, "projects", "write")?;
    let r = sqlx::query("DELETE FROM projects WHERE id=$1 AND workspace_id=$2")
        .bind(id)
        .bind(ctx.workspace_id)
        .execute(&app.db)
        .await
        .map_err(db_err)?;
    if r.rows_affected() == 0 {
        return Err(ApiError::new("not_found", "Projeto nao encontrado"));
    }
    Ok(StatusCode::NO_CONTENT)
}
