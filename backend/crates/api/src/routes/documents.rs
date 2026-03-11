use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{extractors::WorkspaceContext, state::AppState};

/// Monta o Router de documentos (upload, listagem, busca, remoção)
pub fn document_routes() -> Router<AppState> {
    Router::new()
        .route("/documents", get(list_documents).post(upload_document))
        .route("/documents/:id", get(get_document).delete(delete_document))
        .route("/documents/:id/status", get(get_processing_status))
        .route("/documents/:id/chunks", get(list_document_chunks))
        .route("/documents/:id/reprocess", post(reprocess_document))
}

// ─── Query params ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DocumentListQuery {
    pub project_id: Option<String>,
    pub status: Option<String>,     // pending | processing | indexed | error
    pub classification: Option<String>,
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

// ─── Response structs ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DocumentResponse {
    pub id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub processing_status: String,
    pub classification: String,
    pub chunks_count: Option<i32>,
    pub tags: Vec<String>,
    pub project_id: Option<String>,
    pub uploaded_by: Uuid,
    pub created_at: String,
    pub indexed_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DocumentListResponse {
    pub data: Vec<DocumentResponse>,
    pub total: i64,
    pub page: u32,
    pub per_page: u32,
}

#[derive(Debug, Serialize)]
pub struct ProcessingStatusResponse {
    pub document_id: Uuid,
    pub status: String,
    pub progress_percent: Option<i32>,
    pub chunks_created: Option<i32>,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ChunkResponse {
    pub id: Uuid,
    pub chunk_index: u32,
    pub content: String,
    pub token_count: u32,
    pub chunk_type: String,
    pub section_title: Option<String>,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// Lista documentos do workspace com filtros opcionais
pub async fn list_documents(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Query(params): Query<DocumentListQuery>,
) -> Result<Json<DocumentListResponse>, StatusCode> {
    let page = params.page.unwrap_or(1);
    let per_page = params.per_page.unwrap_or(20).min(100);
    let offset = ((page - 1) * per_page) as i64;

    let rows = sqlx::query!(
        r#"
        SELECT id, filename, mime_type, size_bytes, processing_status,
               classification, chunks_count, tags, project_id,
               uploaded_by, created_at, indexed_at,
               COUNT(*) OVER() AS total
        FROM documents
        WHERE workspace_id = $1
          AND ($2::text IS NULL OR processing_status = $2)
          AND ($3::text IS NULL OR classification = $3)
          AND ($4::text IS NULL OR project_id::text = $4)
        ORDER BY created_at DESC
        LIMIT $5 OFFSET $6
        "#,
        ctx.workspace_id,
        params.status,
        params.classification,
        params.project_id,
        per_page as i64,
        offset,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total = rows.first().and_then(|r| r.total).unwrap_or(0);

    let data = rows
        .into_iter()
        .map(|r| DocumentResponse {
            id: r.id,
            filename: r.filename,
            mime_type: r.mime_type,
            size_bytes: r.size_bytes,
            processing_status: r.processing_status,
            classification: r.classification,
            chunks_count: r.chunks_count,
            tags: r.tags,
            project_id: r.project_id.map(|id| id.to_string()),
            uploaded_by: r.uploaded_by,
            created_at: r.created_at.to_rfc3339(),
            indexed_at: r.indexed_at.map(|t| t.to_rfc3339()),
        })
        .collect();

    Ok(Json(DocumentListResponse { data, total, page, per_page }))
}

/// Upload de documento: salva no storage e inicia pipeline de processamento
pub async fn upload_document(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<DocumentResponse>), StatusCode> {
    let mut file_data: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    let mut project_id: Option<String> = None;
    let mut classification = "INTERNAL".to_string();
    let mut use_for_training = true;
    let mut tags: Vec<String> = vec![];

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        match field.name() {
            Some("file") => {
                filename = field.file_name().map(|s| s.to_string());
                file_data = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|_| StatusCode::BAD_REQUEST)?
                        .to_vec(),
                );
            }
            Some("project_id") => {
                project_id = Some(
                    field
                        .text()
                        .await
                        .map_err(|_| StatusCode::BAD_REQUEST)?,
                );
            }
            Some("classification") => {
                classification = field
                    .text()
                    .await
                    .map_err(|_| StatusCode::BAD_REQUEST)?;
            }
            Some("use_for_training") => {
                use_for_training = field
                    .text()
                    .await
                    .map_err(|_| StatusCode::BAD_REQUEST)?
                    == "true";
            }
            Some("tags") => {
                let tags_str = field
                    .text()
                    .await
                    .map_err(|_| StatusCode::BAD_REQUEST)?;
                tags = tags_str
                    .split(',')
                    .map(|t| t.trim().to_string())
                    .filter(|t| !t.is_empty())
                    .collect();
            }
            _ => {}
        }
    }

    let file_data = file_data.ok_or(StatusCode::BAD_REQUEST)?;
    let filename = filename.ok_or(StatusCode::BAD_REQUEST)?;

    // Detecta mime type
    let mime_type = mime_guess::from_path(&filename)
        .first_or_octet_stream()
        .to_string();

    let size_bytes = file_data.len() as i64;

    // Insere documento no banco com status 'pending'
    let doc_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO documents
            (id, workspace_id, filename, mime_type, size_bytes,
             processing_status, classification, use_for_training,
             tags, project_id, uploaded_by)
        VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10)
        "#,
        doc_id,
        ctx.workspace_id,
        filename,
        mime_type,
        size_bytes,
        classification,
        use_for_training,
        &tags,
        project_id.as_ref().and_then(|p| Uuid::parse_str(p).ok()),
        ctx.user_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // TODO: enfileirar para processamento assíncrono (document-processor)
    // app.task_queue.enqueue(ProcessDocumentTask { doc_id, file_data, workspace_id: ctx.workspace_id }).await;

    Ok((
        StatusCode::CREATED,
        Json(DocumentResponse {
            id: doc_id,
            filename,
            mime_type,
            size_bytes,
            processing_status: "pending".into(),
            classification,
            chunks_count: None,
            tags,
            project_id,
            uploaded_by: ctx.user_id,
            created_at: chrono::Utc::now().to_rfc3339(),
            indexed_at: None,
        }),
    ))
}

/// Retorna metadados de um documento específico
pub async fn get_document(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentResponse>, StatusCode> {
    let doc = sqlx::query!(
        r#"
        SELECT id, filename, mime_type, size_bytes, processing_status,
               classification, chunks_count, tags, project_id,
               uploaded_by, created_at, indexed_at
        FROM documents
        WHERE id = $1 AND workspace_id = $2
        "#,
        id,
        ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(DocumentResponse {
        id: doc.id,
        filename: doc.filename,
        mime_type: doc.mime_type,
        size_bytes: doc.size_bytes,
        processing_status: doc.processing_status,
        classification: doc.classification,
        chunks_count: doc.chunks_count,
        tags: doc.tags,
        project_id: doc.project_id.map(|id| id.to_string()),
        uploaded_by: doc.uploaded_by,
        created_at: doc.created_at.to_rfc3339(),
        indexed_at: doc.indexed_at.map(|t| t.to_rfc3339()),
    }))
}

/// Remove documento e seus chunks do Qdrant e do banco
pub async fn delete_document(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query!(
        "DELETE FROM documents WHERE id = $1 AND workspace_id = $2",
        id,
        ctx.workspace_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    // TODO: remover chunks do Qdrant
    // app.qdrant_client.delete_points(workspace_collection, doc_id_filter).await;

    Ok(StatusCode::NO_CONTENT)
}

/// Status de processamento do documento (polling para o frontend)
pub async fn get_processing_status(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProcessingStatusResponse>, StatusCode> {
    let row = sqlx::query!(
        r#"
        SELECT id, processing_status, chunks_count,
               processing_error, processing_started_at, indexed_at
        FROM documents
        WHERE id = $1 AND workspace_id = $2
        "#,
        id,
        ctx.workspace_id,
    )
    .fetch_one(&app.db)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    let progress = match row.processing_status.as_str() {
        "pending" => Some(0),
        "processing" => Some(50),
        "indexed" => Some(100),
        _ => None,
    };

    Ok(Json(ProcessingStatusResponse {
        document_id: row.id,
        status: row.processing_status,
        progress_percent: progress,
        chunks_created: row.chunks_count,
        error_message: row.processing_error,
        started_at: row.processing_started_at.map(|t| t.to_rfc3339()),
        completed_at: row.indexed_at.map(|t| t.to_rfc3339()),
    }))
}

/// Lista chunks de um documento (útil para debug e chunking-preview)
pub async fn list_document_chunks(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ChunkResponse>>, StatusCode> {
    // Chunks são armazenados no Qdrant — aqui listamos metadados do banco
    let chunks = sqlx::query!(
        r#"
        SELECT id, chunk_index, content, token_count, chunk_type, section_title
        FROM document_chunks
        WHERE document_id = $1 AND workspace_id = $2
        ORDER BY chunk_index ASC
        "#,
        id,
        ctx.workspace_id,
    )
    .fetch_all(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        chunks
            .into_iter()
            .map(|c| ChunkResponse {
                id: c.id,
                chunk_index: c.chunk_index as u32,
                content: c.content,
                token_count: c.token_count as u32,
                chunk_type: c.chunk_type,
                section_title: c.section_title,
            })
            .collect(),
    ))
}

/// Força reprocessamento de um documento já indexado (útil após edição)
pub async fn reprocess_document(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        UPDATE documents
        SET processing_status = 'pending',
            processing_error = NULL,
            chunks_count = NULL,
            indexed_at = NULL
        WHERE id = $1 AND workspace_id = $2
        "#,
        id,
        ctx.workspace_id,
    )
    .execute(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // TODO: re-enfileirar no task queue

    Ok(StatusCode::ACCEPTED)
}
