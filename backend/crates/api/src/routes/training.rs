use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{extractors::WorkspaceContext, state::AppState};

pub fn training_routes() -> Router<AppState> {
    Router::new()
        // Feedback de interações
        .route("/feedback", post(submit_feedback))
        // Curadoria (admin/analyst)
        .route("/training/queue", get(list_training_queue))
        .route("/training/queue/:id/approve", put(approve_interaction))
        .route("/training/queue/:id/reject", put(reject_interaction))
        // Status e histórico de batches
        .route("/training/batches", get(list_training_batches))
        .route("/training/batches/:id", get(get_training_batch))
        // Dados sintéticos de documentos
        .route("/training/documents", get(list_training_documents))
}

// ─── Request / Response structs ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct FeedbackRequest {
    pub interaction_id: Uuid,
    pub rating: String,          // "positive" | "negative"
    pub correction: Option<String>,
    pub categories: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct TrainingQueueQuery {
    pub status: Option<String>,  // "pending" | "approved" | "rejected"
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct TrainingInteractionItem {
    pub id: Uuid,
    pub user_message: String,
    pub assistant_response: String,
    pub user_rating: Option<String>,
    pub user_correction: Option<String>,
    pub feedback_categories: Option<String>,
    pub curator_status: String,
    pub data_classification: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct TrainingBatchResponse {
    pub id: Uuid,
    pub base_model: String,
    pub previous_lora_version: Option<String>,
    pub new_lora_version: Option<String>,
    pub status: String,
    pub total_examples: Option<i32>,
    pub positive_examples: Option<i32>,
    pub corrected_examples: Option<i32>,
    pub training_loss: Option<f64>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub deployed_at: Option<String>,
    pub created_at: String,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// Recebe feedback do usuário sobre uma resposta do modelo
pub async fn submit_feedback(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Json(req): Json<FeedbackRequest>,
) -> Result<StatusCode, StatusCode> {
    // Verifica se a interação pertence ao workspace
    let exists = sqlx::query!(
        "SELECT 1 AS exists FROM training_interactions WHERE id = $1 AND workspace_id = $2",
        req.interaction_id,
        ctx.workspace_id,
    )
    .fetch_optional(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if exists.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    sqlx::query!(
        r#"
        UPDATE training_interactions
        SET user_rating = $2,
            user_correction = $3,
            feedback_categories = $4,
            -- thumbs up sem correção → aprovação automática
            curator_status = CASE
                WHEN $2 = 'positive' AND $3 IS NULL THEN 'approved'
                ELSE 'pending'
            END
        WHERE id = $1
        "#,
        req.interaction_id,
        req.rating,
        req.correction,
        req.categories.as_ref().map(|c| c.join(",")),
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

/// Lista fila de curadoria com filtros de status
pub async fn list_training_queue(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Query(params): Query<TrainingQueueQuery>,
) -> Result<Json<Vec<TrainingInteractionItem>>, StatusCode> {
    let page = params.page.unwrap_or(1);
    let per_page = params.per_page.unwrap_or(20).min(100);
    let offset = ((page - 1) * per_page) as i64;

    let rows = sqlx::query!(
        r#"
        SELECT id, user_message, assistant_response, user_rating,
               user_correction, feedback_categories, curator_status,
               data_classification, created_at
        FROM training_interactions
        WHERE workspace_id = $1
          AND eligible_for_training = true
          AND ($2::text IS NULL OR curator_status = $2)
        ORDER BY
            CASE WHEN user_correction IS NOT NULL THEN 0 ELSE 1 END,
            created_at DESC
        LIMIT $3 OFFSET $4
        "#,
        ctx.workspace_id,
        params.status,
        per_page as i64,
        offset,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| TrainingInteractionItem {
                id: r.id,
                user_message: r.user_message,
                assistant_response: r.assistant_response,
                user_rating: r.user_rating,
                user_correction: r.user_correction,
                feedback_categories: r.feedback_categories,
                curator_status: r.curator_status,
                data_classification: r.data_classification,
                created_at: r.created_at.to_rfc3339(),
            })
            .collect(),
    ))
}

/// Aprova uma interação para uso em treinamento
pub async fn approve_interaction(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        UPDATE training_interactions
        SET curator_status = 'approved', curator_id = $2, curated_at = NOW()
        WHERE id = $1 AND workspace_id = $3
        "#,
        id,
        ctx.user_id,
        ctx.workspace_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

/// Rejeita uma interação (não será usada no treino)
pub async fn reject_interaction(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        UPDATE training_interactions
        SET curator_status = 'rejected', curator_id = $2, curated_at = NOW()
        WHERE id = $1 AND workspace_id = $3
        "#,
        id,
        ctx.user_id,
        ctx.workspace_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

/// Lista histórico de batches de treinamento
pub async fn list_training_batches(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
) -> Result<Json<Vec<TrainingBatchResponse>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT id, base_model, previous_lora_version, new_lora_version,
               status, total_examples, positive_examples, corrected_examples,
               training_loss, started_at, completed_at, deployed_at, created_at
        FROM training_batches
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
        ctx.workspace_id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| TrainingBatchResponse {
                id: r.id,
                base_model: r.base_model,
                previous_lora_version: r.previous_lora_version,
                new_lora_version: r.new_lora_version,
                status: r.status,
                total_examples: r.total_examples,
                positive_examples: r.positive_examples,
                corrected_examples: r.corrected_examples,
                training_loss: r.training_loss,
                started_at: r.started_at.map(|t| t.to_rfc3339()),
                completed_at: r.completed_at.map(|t| t.to_rfc3339()),
                deployed_at: r.deployed_at.map(|t| t.to_rfc3339()),
                created_at: r.created_at.to_rfc3339(),
            })
            .collect(),
    ))
}

pub async fn get_training_batch(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<Json<TrainingBatchResponse>, StatusCode> {
    let r = sqlx::query!(
        r#"
        SELECT id, base_model, previous_lora_version, new_lora_version,
               status, total_examples, positive_examples, corrected_examples,
               training_loss, started_at, completed_at, deployed_at, created_at
        FROM training_batches
        WHERE id = $1 AND workspace_id = $2
        "#,
        id,
        ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(TrainingBatchResponse {
        id: r.id,
        base_model: r.base_model,
        previous_lora_version: r.previous_lora_version,
        new_lora_version: r.new_lora_version,
        status: r.status,
        total_examples: r.total_examples,
        positive_examples: r.positive_examples,
        corrected_examples: r.corrected_examples,
        training_loss: r.training_loss,
        started_at: r.started_at.map(|t| t.to_rfc3339()),
        completed_at: r.completed_at.map(|t| t.to_rfc3339()),
        deployed_at: r.deployed_at.map(|t| t.to_rfc3339()),
        created_at: r.created_at.to_rfc3339(),
    }))
}

/// Lista documentos usados para geração de QA sintéticos
pub async fn list_training_documents(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT id, document_name, chunk_text, generated_question,
               generated_answer, classification, curator_status, created_at
        FROM training_documents
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        "#,
        ctx.workspace_id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| serde_json::json!({
                "id": r.id,
                "document_name": r.document_name,
                "chunk_text": r.chunk_text,
                "generated_question": r.generated_question,
                "generated_answer": r.generated_answer,
                "classification": r.classification,
                "curator_status": r.curator_status,
                "created_at": r.created_at.to_rfc3339(),
            }))
            .collect(),
    ))
}
