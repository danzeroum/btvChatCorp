use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::{error_response, ApiError},
    middleware::api_key_auth::ApiKeyContext,
    state::AppState,
};

#[derive(Debug, Serialize, ToSchema)]
pub struct WebhookResponse {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub events: Vec<String>,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateWebhookRequest {
    pub name: String,
    pub url: String,
    pub events: Vec<String>,
    pub secret: Option<String>,
    pub max_retries: Option<i32>,
    pub timeout_secs: Option<i32>,
}

/// GET /api/v1/webhooks
#[utoipa::path(
    get, path = "/api/v1/webhooks", tag = "Webhooks",
    responses((status = 200, body = Vec<WebhookResponse>)),
    security(("api_key" = []))
)]
pub async fn list_webhooks(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
) -> Result<Json<Vec<WebhookResponse>>, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("webhooks", "read") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions", "webhooks:read required"));
    }

    let rows = sqlx::query!(
        "SELECT id, name, url, events, status, created_at FROM webhooks WHERE workspace_id = $1 ORDER BY created_at DESC",
        ctx.workspace_id
    )
    .fetch_all(&app.db)
    .await
    .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?;

    let result = rows.into_iter().map(|r| WebhookResponse {
        id: r.id,
        name: r.name,
        url: r.url,
        events: r.events.unwrap_or_default(),
        status: r.status.unwrap_or_else(|| "active".into()),
        created_at: r.created_at.unwrap_or_else(chrono::Utc::now),
    }).collect();

    Ok(Json(result))
}

/// POST /api/v1/webhooks
#[utoipa::path(
    post, path = "/api/v1/webhooks", tag = "Webhooks",
    request_body = CreateWebhookRequest,
    responses((status = 201, body = WebhookResponse)),
    security(("api_key" = []))
)]
pub async fn create_webhook(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Json(req): Json<CreateWebhookRequest>,
) -> Result<(StatusCode, Json<WebhookResponse>), (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("webhooks", "write") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions", "webhooks:write required"));
    }

    let secret = req.secret.unwrap_or_else(|| format!("whsec_{}", Uuid::new_v4().simple()));
    let events_json = serde_json::to_value(&req.events).unwrap_or_default();

    let id = Uuid::new_v4();
    sqlx::query!(
        r#"INSERT INTO webhooks (id, workspace_id, name, url, events, secret, max_retries, timeout_secs)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)"#,
        id, ctx.workspace_id, req.name, req.url, events_json,
        secret, req.max_retries.unwrap_or(5), req.timeout_secs.unwrap_or(10)
    )
    .execute(&app.db)
    .await
    .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?;

    Ok((StatusCode::CREATED, Json(WebhookResponse {
        id,
        name: req.name,
        url: req.url,
        events: req.events,
        status: "active".into(),
        created_at: chrono::Utc::now(),
    })))
}

/// GET /api/v1/webhooks/:id
pub async fn get_webhook(
    State(_app): State<AppState>,
    Extension(_ctx): Extension<ApiKeyContext>,
    Path(_id): Path<Uuid>,
) -> StatusCode { StatusCode::NOT_IMPLEMENTED }

/// PUT /api/v1/webhooks/:id
pub async fn update_webhook(
    State(_app): State<AppState>,
    Extension(_ctx): Extension<ApiKeyContext>,
    Path(_id): Path<Uuid>,
) -> StatusCode { StatusCode::NOT_IMPLEMENTED }

/// DELETE /api/v1/webhooks/:id
pub async fn delete_webhook(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    sqlx::query!("DELETE FROM webhooks WHERE id = $1 AND workspace_id = $2", id, ctx.workspace_id)
        .execute(&app.db)
        .await
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/webhooks/:id/test
pub async fn test_webhook(
    State(_app): State<AppState>,
    Extension(_ctx): Extension<ApiKeyContext>,
    Path(_id): Path<Uuid>,
) -> StatusCode { StatusCode::OK }

/// GET /api/v1/webhooks/:id/deliveries
pub async fn list_deliveries(
    State(_app): State<AppState>,
    Extension(_ctx): Extension<ApiKeyContext>,
    Path(_id): Path<Uuid>,
) -> Json<serde_json::Value> { Json(serde_json::json!({"deliveries": []})) }
