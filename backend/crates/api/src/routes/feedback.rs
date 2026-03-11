use axum::{
    extract::{Extension, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use ai_orchestrator::{Feedback, TrainingRepo};
use crate::{
    errors::{error_response, ApiError},
    middleware::api_key_auth::ApiKeyContext,
    state::AppState,
};

#[derive(Debug, Deserialize, ToSchema)]
pub struct FeedbackRequest {
    pub interaction_id: Uuid,
    pub rating: Option<String>,     // "positive" | "negative"
    pub correction: Option<String>,
    pub categories: Option<String>, // "factual_error,incomplete"
}

/// POST /api/v1/feedback
#[utoipa::path(
    post,
    path = "/api/v1/feedback",
    tag = "Training",
    request_body = FeedbackRequest,
    responses(
        (status = 200, description = "Feedback registrado com sucesso"),
        (status = 403, description = "Sem permissão"),
    ),
    security(("api_key" = []))
)]
pub async fn submit_feedback(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Json(req): Json<FeedbackRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("training", "write") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions",
            "training:write permission required"));
    }

    let has_correction = req.correction.is_some();

    app.training
        .add_feedback(req.interaction_id, Feedback {
            rating: req.rating,
            correction: req.correction,
            categories: req.categories,
            user_id: ctx.key_id, // usa key_id como proxy de user em integrações externas
        })
        .await
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?;

    if has_correction {
        let _ = app.training.flag_high_priority(req.interaction_id).await;
    }

    Ok(StatusCode::OK)
}

/// GET /api/v1/training/status
pub async fn get_training_status(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let row = sqlx::query!(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE curator_status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE curator_status = 'approved') AS approved,
            COUNT(*) FILTER (WHERE user_rating = 'positive') AS positive_feedback
        FROM training_interactions
        WHERE workspace_id = $1
        "#,
        ctx.workspace_id
    )
    .fetch_one(&app.db)
    .await
    .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?;

    Ok(Json(serde_json::json!({
        "pending_review": row.pending,
        "approved": row.approved,
        "positive_feedback": row.positive_feedback,
    })))
}
