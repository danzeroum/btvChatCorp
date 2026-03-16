use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    routing::{delete, get},
    Extension, Json, Router,
};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::document::Document,
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/documents", get(list).post(upload))
        .route("/documents/:id", get(get_one).delete(remove))
        .route("/projects/:id/documents", get(list_for_project).post(link_to_project))
        .route("/projects/:id/documents/:did", delete(unlink_from_project))
}

/// Lista documentos do workspace
#[utoipa::path(
    get,
    path = "/api/v1/documents",
    tag = "Documents",
    security(("BearerAuth" = [])),
    responses(
        (status = 200, description = "Lista de documentos", body = Vec<Document>),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn list(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Document>>, AppError> {
    let rows = sqlx::query_as::<_, Document>(
        r#"SELECT id, workspace_id, filename, original_filename, mime_type,
               size_bytes, file_hash, storage_path, processing_status,
               page_count, chunk_count, uploaded_by, created_at, updated_at
        FROM documents WHERE workspace_id=$1 ORDER BY created_at DESC"#,
    )
    .bind(auth.workspace_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// Upload de documento (multipart/form-data, campo 'file', max 50 MB)
#[utoipa::path(
    post,
    path = "/api/v1/documents",
    tag = "Documents",
    security(("BearerAuth" = [])),
    request_body(
        content_type = "multipart/form-data",
        content = String,
        description = "Arquivo a ser enviado (campo: file)"
    ),
    responses(
        (status = 201, description = "Documento enviado", body = Document),
        (status = 400, description = "Arquivo invalido ou maior que 50MB"),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn upload(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Document>), AppError> {
    let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "/uploads".into());
    let upload_path = PathBuf::from(&upload_dir);
    tokio::fs::create_dir_all(&upload_path)
        .await
        .map_err(|e| AppError::internal(e.to_string()))?;

    if let Some(field) = multipart
        .next_field().await
        .map_err(|e| AppError::bad_request(e.to_string()))?
    {
        let original_name = field.file_name().unwrap_or("arquivo").to_string();
        let mime = field.content_type().unwrap_or("application/octet-stream").to_string();
        let data = field.bytes().await.map_err(|e| AppError::bad_request(e.to_string()))?;

        if data.len() > 50 * 1024 * 1024 {
            return Err(AppError::bad_request("Arquivo maior que 50MB"));
        }

        let mut hasher = Sha256::new();
        hasher.update(&data);
        let hash = format!("{:x}", hasher.finalize());
        let hash_short = &hash[..16];

        let stored_name = format!("{hash_short}_{original_name}");
        let dest = upload_path.join(&stored_name);
        tokio::fs::write(&dest, &data)
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;

        let row = sqlx::query_as::<_, Document>(
            r#"INSERT INTO documents
                (workspace_id, filename, original_filename, mime_type,
                 size_bytes, file_hash, storage_path, uploaded_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *"#,
        )
        .bind(auth.workspace_id)
        .bind(&stored_name)
        .bind(&original_name)
        .bind(&mime)
        .bind(data.len() as i64)
        .bind(hash_short)
        .bind(dest.to_string_lossy().as_ref())
        .bind(auth.user_id)
        .fetch_one(&state.db)
        .await?;

        return Ok((StatusCode::CREATED, Json(row)));
    }
    Err(AppError::bad_request("Nenhum arquivo enviado"))
}

/// Busca documento por ID
#[utoipa::path(
    get,
    path = "/api/v1/documents/{id}",
    tag = "Documents",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do documento")),
    responses(
        (status = 200, description = "Documento encontrado", body = Document),
        (status = 404, description = "Documento nao encontrado"),
    )
)]
async fn get_one(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Document>, AppError> {
    let row = sqlx::query_as::<_, Document>("SELECT * FROM documents WHERE id=$1 AND workspace_id=$2")
        .bind(id).bind(auth.workspace_id)
        .fetch_one(&state.db).await?;
    Ok(Json(row))
}

/// Remove documento
#[utoipa::path(
    delete,
    path = "/api/v1/documents/{id}",
    tag = "Documents",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do documento")),
    responses(
        (status = 204, description = "Removido"),
        (status = 404, description = "Documento nao encontrado"),
    )
)]
async fn remove(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let r = sqlx::query("DELETE FROM documents WHERE id=$1 AND workspace_id=$2")
        .bind(id).bind(auth.workspace_id)
        .execute(&state.db).await.map_err(AppError::from)?;
    if r.rows_affected() == 0 {
        return Err(AppError::not_found("Documento nao encontrado"));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Lista documentos vinculados a um projeto
#[utoipa::path(
    get,
    path = "/api/v1/projects/{id}/documents",
    tag = "Documents",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do projeto")),
    responses(
        (status = 200, description = "Documentos do projeto", body = Vec<Document>),
        (status = 404, description = "Projeto nao encontrado"),
    )
)]
async fn list_for_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Document>>, AppError> {
    sqlx::query("SELECT id FROM projects WHERE id=$1 AND workspace_id=$2")
        .bind(project_id).bind(auth.workspace_id)
        .fetch_one(&state.db).await
        .map_err(|_| AppError::not_found("Projeto nao encontrado"))?;

    let rows = sqlx::query_as::<_, Document>(
        r#"SELECT d.id, d.workspace_id, d.filename, d.original_filename, d.mime_type,
               d.size_bytes, d.file_hash, d.storage_path, d.processing_status,
               d.page_count, d.chunk_count, d.uploaded_by, d.created_at, d.updated_at
        FROM documents d
        JOIN project_documents pd ON pd.document_id = d.id
        WHERE pd.project_id=$1 ORDER BY pd.linked_at DESC"#,
    ).bind(project_id).fetch_all(&state.db).await?;
    Ok(Json(rows))
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct LinkDto {
    /// ID do documento a vincular
    document_id: Uuid,
}

/// Vincula documento existente a um projeto
#[utoipa::path(
    post,
    path = "/api/v1/projects/{id}/documents",
    tag = "Documents",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do projeto")),
    request_body = LinkDto,
    responses(
        (status = 201, description = "Documento vinculado"),
        (status = 404, description = "Projeto nao encontrado"),
    )
)]
async fn link_to_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(dto): Json<LinkDto>,
) -> Result<StatusCode, AppError> {
    sqlx::query(
        "INSERT INTO project_documents (project_id, document_id, linked_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
    )
    .bind(project_id).bind(dto.document_id).bind(auth.user_id)
    .execute(&state.db).await.map_err(AppError::from)?;
    Ok(StatusCode::CREATED)
}

/// Desvincula documento de um projeto
#[utoipa::path(
    delete,
    path = "/api/v1/projects/{id}/documents/{did}",
    tag = "Documents",
    security(("BearerAuth" = [])),
    params(
        ("id" = Uuid, Path, description = "ID do projeto"),
        ("did" = Uuid, Path, description = "ID do documento"),
    ),
    responses(
        (status = 204, description = "Desvinculado"),
    )
)]
async fn unlink_from_project(
    _auth: Extension<AuthUser>,
    State(state): State<AppState>,
    Path((project_id, doc_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM project_documents WHERE project_id=$1 AND document_id=$2")
        .bind(project_id).bind(doc_id)
        .execute(&state.db).await.map_err(AppError::from)?;
    Ok(StatusCode::NO_CONTENT)
}
