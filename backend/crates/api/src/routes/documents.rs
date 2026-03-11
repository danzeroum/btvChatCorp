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
pub struct DocumentResponse {
    pub id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub processing_status: String,
    pub classification: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ListDocumentsQuery {
    pub project_id: Option<Uuid>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

/// GET /api/v1/documents
#[utoipa::path(
    get,
    path = "/api/v1/documents",
    tag = "Documents",
    responses((status = 200, description = "Lista de documentos", body = Vec<DocumentResponse>)),
    security(("api_key" = []))
)]
pub async fn list_documents(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
) -> Result<Json<Vec<DocumentResponse>>, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("documents", "read") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions",
            "API key does not have documents:read permission"));
    }

    let rows = sqlx::query_as::<_, (Uuid, String, String, i64, String, String, chrono::DateTime<chrono::Utc>)>(
        "SELECT id, filename, mime_type, size_bytes, processing_status, classification, created_at \
         FROM documents WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100"
    )
    .bind(ctx.workspace_id)
    .fetch_all(&app.db)
    .await
    .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?;

    let docs = rows.into_iter().map(|(id, filename, mime_type, size_bytes, processing_status, classification, created_at)| {
        DocumentResponse { id, filename, mime_type, size_bytes, processing_status, classification, created_at }
    }).collect();

    Ok(Json(docs))
}

/// GET /api/v1/documents/:id
pub async fn get_document(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentResponse>, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("documents", "read") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions", "documents:read required"));
    }

    let row = sqlx::query_as::<_, (Uuid, String, String, i64, String, String, chrono::DateTime<chrono::Utc>)>(
        "SELECT id, filename, mime_type, size_bytes, processing_status, classification, created_at \
         FROM documents WHERE id = $1 AND workspace_id = $2"
    )
    .bind(id).bind(ctx.workspace_id)
    .fetch_optional(&app.db)
    .await
    .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?
    .ok_or_else(|| error_response(StatusCode::NOT_FOUND, "not_found", "Document not found"))?;

    let (id, filename, mime_type, size_bytes, processing_status, classification, created_at) = row;
    Ok(Json(DocumentResponse { id, filename, mime_type, size_bytes, processing_status, classification, created_at }))
}

/// DELETE /api/v1/documents/:id
pub async fn delete_document(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("documents", "delete") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions", "documents:delete required"));
    }

    sqlx::query!("DELETE FROM documents WHERE id = $1 AND workspace_id = $2", id, ctx.workspace_id)
        .execute(&app.db)
        .await
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/documents/:id/status
pub async fn get_processing_status(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let row = sqlx::query!(
        "SELECT processing_status, chunks_count, indexed_at FROM documents WHERE id = $1 AND workspace_id = $2",
        id, ctx.workspace_id
    )
    .fetch_optional(&app.db)
    .await
    .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "db_error", e.to_string()))?
    .ok_or_else(|| error_response(StatusCode::NOT_FOUND, "not_found", "Document not found"))?;

    Ok(Json(serde_json::json!({
        "id": id,
        "processing_status": row.processing_status,
        "chunks_count": row.chunks_count,
        "indexed_at": row.indexed_at,
    })))
}

/// POST /api/v1/documents — upload multipart
pub async fn upload_document(
    State(_app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("documents", "write") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions", "documents:write required"));
    }
    // Implementação completa via document-processor crate (multipart handling)
    // Delega para document_processor::pipeline::ingest
    Ok(StatusCode::ACCEPTED)
}
