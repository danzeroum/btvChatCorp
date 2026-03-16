use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, put},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{errors::AppError, middleware::auth::AuthUser, state::AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/training/queue", get(list_queue))
        .route("/training/queue/:id/approve", put(approve))
        .route("/training/queue/:id/reject", put(reject))
        .route("/training/batches", get(list_batches).post(start_batch))
        .route("/training/batches/:id", get(get_batch))
        .route("/training/batches/:id/status", get(poll_batch_status))
        .route("/training/documents", get(list_documents))
}

#[derive(Debug, FromRow, Serialize, ToSchema)]
pub struct TrainingInteraction {
    pub id: Uuid,
    pub user_message: String,
    pub assistant_response: String,
    pub user_rating: Option<String>,
    pub user_correction: Option<String>,
    pub feedback_categories: Option<String>,
    /// pending | approved | rejected
    pub curator_status: String,
    pub data_classification: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, ToSchema)]
pub struct TrainingBatch {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub base_model: String,
    pub previous_lora_version: Option<String>,
    pub new_lora_version: Option<String>,
    /// queued | running | completed | failed
    pub status: String,
    pub total_examples: Option<i32>,
    pub positive_examples: Option<i32>,
    pub corrected_examples: Option<i32>,
    pub progress: Option<i32>,
    pub current_epoch: Option<i32>,
    pub total_epochs: Option<i32>,
    pub training_loss: Option<f64>,
    pub eval_accuracy: Option<f64>,
    pub external_job_id: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub deployed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow, Serialize, ToSchema)]
pub struct TrainingDocument {
    pub id: Uuid,
    pub document_name: String,
    pub chunk_text: String,
    pub generated_question: String,
    pub generated_answer: String,
    pub classification: String,
    pub curator_status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct QueueQuery {
    /// Filtra por status: pending | approved | rejected
    pub status: Option<String>,
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct StartBatchDto {
    /// Modelo base (default: llama3.1:8b)
    pub base_model: Option<String>,
    /// Epocas de treinamento (default: 3)
    pub total_epochs: Option<i32>,
}

#[utoipa::path(
    get,
    path = "/api/v1/training/queue",
    tag = "Training",
    security(("BearerAuth" = [])),
    params(
        ("status" = Option<String>, Query, description = "pending | approved | rejected"),
        ("page" = Option<u32>, Query, description = "Pagina (default: 1)"),
        ("per_page" = Option<u32>, Query, description = "Itens por pagina (default: 20, max: 100)"),
    ),
    responses(
        (status = 200, description = "Interacoes para curadoria", body = Vec<TrainingInteraction>),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn list_queue(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Query(q): Query<QueueQuery>,
) -> Result<Json<Vec<TrainingInteraction>>, AppError> {
    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(20).min(100);
    let offset = ((page - 1) * per_page) as i64;

    let rows = sqlx::query_as::<_, TrainingInteraction>(
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
    )
    .bind(auth.workspace_id)
    .bind(q.status)
    .bind(per_page as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

#[utoipa::path(
    put,
    path = "/api/v1/training/queue/{id}/approve",
    tag = "Training",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID da interacao")),
    responses(
        (status = 200, description = "Aprovada"),
        (status = 404, description = "Interacao nao encontrada"),
    )
)]
async fn approve(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let r = sqlx::query(
        "UPDATE training_interactions
         SET curator_status='approved', curator_id=$1, curated_at=NOW()
         WHERE id=$2 AND workspace_id=$3",
    )
    .bind(auth.user_id)
    .bind(id)
    .bind(auth.workspace_id)
    .execute(&state.db)
    .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::not_found("Interacao nao encontrada"));
    }
    Ok(StatusCode::OK)
}

#[utoipa::path(
    put,
    path = "/api/v1/training/queue/{id}/reject",
    tag = "Training",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID da interacao")),
    responses(
        (status = 200, description = "Rejeitada"),
        (status = 404, description = "Interacao nao encontrada"),
    )
)]
async fn reject(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let r = sqlx::query(
        "UPDATE training_interactions
         SET curator_status='rejected', curator_id=$1, curated_at=NOW()
         WHERE id=$2 AND workspace_id=$3",
    )
    .bind(auth.user_id)
    .bind(id)
    .bind(auth.workspace_id)
    .execute(&state.db)
    .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::not_found("Interacao nao encontrada"));
    }
    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/api/v1/training/batches",
    tag = "Training",
    security(("BearerAuth" = [])),
    responses(
        (status = 200, description = "Lista de batches", body = Vec<TrainingBatch>),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn list_batches(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Vec<TrainingBatch>>, AppError> {
    let rows = sqlx::query_as::<_, TrainingBatch>(
        r#"
        SELECT id, workspace_id, base_model, previous_lora_version, new_lora_version,
               status, total_examples, positive_examples, corrected_examples,
               progress, current_epoch, total_epochs, training_loss, eval_accuracy,
               external_job_id, error_message,
               created_at, started_at, completed_at, deployed_at
        FROM training_batches
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(auth.workspace_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/training/batches",
    tag = "Training",
    security(("BearerAuth" = [])),
    request_body = StartBatchDto,
    responses(
        (status = 201, description = "Batch iniciado", body = TrainingBatch),
        (status = 400, description = "Nenhum exemplo aprovado disponivel"),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn start_batch(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Json(dto): Json<StartBatchDto>,
) -> Result<(StatusCode, Json<TrainingBatch>), AppError> {
    let base_model = dto.base_model.unwrap_or_else(|| "llama3.1:8b".into());
    let total_epochs = dto.total_epochs.unwrap_or(3);

    let (total, positive, corrected): (i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COUNT(*),
            COUNT(*) FILTER (WHERE user_rating = 'positive'),
            COUNT(*) FILTER (WHERE user_correction IS NOT NULL)
        FROM training_interactions
        WHERE workspace_id = $1 AND curator_status = 'approved'
        "#,
    )
    .bind(auth.workspace_id)
    .fetch_one(&state.db)
    .await?;

    if total == 0 {
        return Err(AppError::bad_request(
            "Nenhum exemplo aprovado disponivel para treinamento",
        ));
    }

    let batch = sqlx::query_as::<_, TrainingBatch>(
        r#"
        INSERT INTO training_batches
            (workspace_id, base_model, status, total_examples,
             positive_examples, corrected_examples, total_epochs)
        VALUES ($1, $2, 'queued', $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(auth.workspace_id)
    .bind(&base_model)
    .bind(total as i32)
    .bind(positive as i32)
    .bind(corrected as i32)
    .bind(total_epochs)
    .fetch_one(&state.db)
    .await?;

    let external_job_id = submit_to_training_service(&batch)
        .await
        .unwrap_or_else(|_| format!("mock-job-{}", batch.id));

    sqlx::query(
        "UPDATE training_batches SET external_job_id=$1, status='running', started_at=NOW() WHERE id=$2",
    )
    .bind(&external_job_id)
    .bind(batch.id)
    .execute(&state.db)
    .await?;

    let updated = sqlx::query_as::<_, TrainingBatch>("SELECT * FROM training_batches WHERE id=$1")
        .bind(batch.id)
        .fetch_one(&state.db)
        .await?;

    Ok((StatusCode::CREATED, Json(updated)))
}

#[utoipa::path(
    get,
    path = "/api/v1/training/batches/{id}",
    tag = "Training",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do batch")),
    responses(
        (status = 200, description = "Batch encontrado", body = TrainingBatch),
        (status = 404, description = "Batch nao encontrado"),
    )
)]
async fn get_batch(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TrainingBatch>, AppError> {
    let row = sqlx::query_as::<_, TrainingBatch>(
        "SELECT * FROM training_batches WHERE id=$1 AND workspace_id=$2",
    )
    .bind(id)
    .bind(auth.workspace_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::not_found("Batch nao encontrado"))?;
    Ok(Json(row))
}

#[utoipa::path(
    get,
    path = "/api/v1/training/batches/{id}/status",
    tag = "Training",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do batch")),
    responses(
        (status = 200, description = "Status do batch"),
        (status = 404, description = "Batch nao encontrado"),
    )
)]
async fn poll_batch_status(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let batch = sqlx::query_as::<_, TrainingBatch>(
        "SELECT * FROM training_batches WHERE id=$1 AND workspace_id=$2",
    )
    .bind(id)
    .bind(auth.workspace_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::not_found("Batch nao encontrado"))?;

    if let Some(ref job_id) = batch.external_job_id {
        if batch.status == "running" || batch.status == "queued" {
            if let Ok(remote) = fetch_job_status(job_id).await {
                sqlx::query(
                    "UPDATE training_batches
                     SET status=$1, progress=$2, current_epoch=$3, training_loss=$4,
                         completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END
                     WHERE id=$5",
                )
                .bind(&remote.status)
                .bind(remote.progress)
                .bind(remote.current_epoch)
                .bind(remote.training_loss)
                .bind(batch.id)
                .execute(&state.db)
                .await
                .ok();
            }
        }
    }

    let refreshed = sqlx::query_as::<_, TrainingBatch>("SELECT * FROM training_batches WHERE id=$1")
        .bind(batch.id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(serde_json::json!({
        "id":            refreshed.id,
        "status":        refreshed.status,
        "progress":      refreshed.progress,
        "current_epoch": refreshed.current_epoch,
        "total_epochs":  refreshed.total_epochs,
        "training_loss": refreshed.training_loss,
        "eval_accuracy": refreshed.eval_accuracy,
        "error_message": refreshed.error_message,
    })))
}

#[utoipa::path(
    get,
    path = "/api/v1/training/documents",
    tag = "Training",
    security(("BearerAuth" = [])),
    responses(
        (status = 200, description = "Documentos sinteticos", body = Vec<TrainingDocument>),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn list_documents(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Vec<TrainingDocument>>, AppError> {
    let rows = sqlx::query_as::<_, TrainingDocument>(
        r#"
        SELECT id, document_name, chunk_text, generated_question,
               generated_answer, classification, curator_status, created_at
        FROM training_documents
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .bind(auth.workspace_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

struct RemoteJobStatus {
    status: String,
    progress: Option<i32>,
    current_epoch: Option<i32>,
    training_loss: Option<f64>,
}

async fn submit_to_training_service(batch: &TrainingBatch) -> anyhow::Result<String> {
    if std::env::var("TRAINING_MOCK").as_deref() == Ok("true") {
        return Ok(format!("mock-job-{}", batch.id));
    }
    let url = std::env::var("TRAINING_URL")
        .unwrap_or_else(|_| "https://api.buildtovalue.cloud".into());
    let resp = reqwest::Client::new()
        .post(format!("{}/v1/training/jobs", url))
        .json(&serde_json::json!({
            "batch_id":     batch.id,
            "base_model":   batch.base_model,
            "total_epochs": batch.total_epochs,
            "workspace_id": batch.workspace_id,
        }))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;
    Ok(resp["job_id"].as_str().unwrap_or("").to_string())
}

async fn fetch_job_status(job_id: &str) -> anyhow::Result<RemoteJobStatus> {
    if std::env::var("TRAINING_MOCK").as_deref() == Ok("true") {
        return Ok(RemoteJobStatus {
            status: "running".into(),
            progress: Some(42),
            current_epoch: Some(1),
            training_loss: Some(0.35),
        });
    }
    let url = std::env::var("TRAINING_URL")
        .unwrap_or_else(|_| "https://api.buildtovalue.cloud".into());
    let resp = reqwest::Client::new()
        .get(format!("{}/v1/training/jobs/{}", url, job_id))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;
    Ok(RemoteJobStatus {
        status: resp["status"].as_str().unwrap_or("unknown").to_string(),
        progress: resp["progress"].as_i64().map(|v| v as i32),
        current_epoch: resp["current_epoch"].as_i64().map(|v| v as i32),
        training_loss: resp["training_loss"].as_f64(),
    })
}
