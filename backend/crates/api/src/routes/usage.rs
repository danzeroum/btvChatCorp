use axum::{
    extract::{Extension, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use utoipa::ToSchema;

use crate::{
    errors::{error_response, ApiError},
    middleware::api_key_auth::ApiKeyContext,
    state::AppState,
};

#[derive(Debug, Serialize, ToSchema)]
pub struct UsageResponse {
    pub workspace_id: String,
    pub period: String,
    pub total_requests: i64,
    pub total_tokens_input: i64,
    pub total_tokens_output: i64,
    pub total_documents: i64,
    pub total_interactions: i64,
}

/// GET /api/v1/usage
#[utoipa::path(
    get, path = "/api/v1/usage", tag = "Usage",
    responses((status = 200, body = UsageResponse)),
    security(("api_key" = []))
)]
pub async fn get_usage(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
) -> Result<Json<UsageResponse>, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("usage", "read") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions", "usage:read required"));
    }

    let interactions = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM training_interactions WHERE workspace_id = $1",
        ctx.workspace_id
    ).fetch_one(&app.db).await.unwrap_or(Some(0)).unwrap_or(0);

    let documents = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM documents WHERE workspace_id = $1",
        ctx.workspace_id
    ).fetch_one(&app.db).await.unwrap_or(Some(0)).unwrap_or(0);

    Ok(Json(UsageResponse {
        workspace_id: ctx.workspace_id.to_string(),
        period: "last_30_days".into(),
        total_requests: interactions,
        total_tokens_input: 0,   // TODO: somar prompt_tokens
        total_tokens_output: 0,  // TODO: somar completion_tokens
        total_documents: documents,
        total_interactions: interactions,
    }))
}

/// GET /api/v1/usage/breakdown
pub async fn get_breakdown(
    State(_app): State<AppState>,
    Extension(_ctx): Extension<ApiKeyContext>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({"breakdown": []}))
}
