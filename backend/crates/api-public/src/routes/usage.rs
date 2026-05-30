//! Métricas de uso da API Pública.
//!
//! Implementação nativa (sem delegar ao crate `api`): consulta apenas por
//! `workspace_id` do `ApiKeyContext`, sem tocar em FKs de `users`, o que a torna
//! segura sob autenticação por API key.

use axum::{
    extract::{Extension, State},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use utoipa::ToSchema;

use crate::{errors::ApiError, models::api_key::ApiKeyContext};
use crate_api::state::AppState;

pub fn usage_routes() -> Router<AppState> {
    Router::new().route("/usage", get(get_usage))
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UsageResponse {
    pub workspace_id: String,
    pub period: String,
    pub total_interactions: i64,
    pub total_documents: i64,
}

/// GET /api/v1/usage — totais agregados do workspace da API key.
pub async fn get_usage(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
) -> Result<Json<UsageResponse>, ApiError> {
    if !ctx.permissions.iter().any(|p| p.allows("usage", "read")) {
        return Err(ApiError::new(
            "insufficient_permissions",
            "usage:read required",
        ));
    }

    let interactions = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM training_interactions WHERE workspace_id = $1",
        ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| ApiError::new("internal_error", "failed to query interactions"))?
    .unwrap_or(0);

    let documents = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM documents WHERE workspace_id = $1",
        ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| ApiError::new("internal_error", "failed to query documents"))?
    .unwrap_or(0);

    Ok(Json(UsageResponse {
        workspace_id: ctx.workspace_id.to_string(),
        period: "all_time".into(),
        total_interactions: interactions,
        total_documents: documents,
    }))
}
