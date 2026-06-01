use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    routing::{delete, post},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

const MAX_FILE_BYTES: usize = 10 * 1024 * 1024; // 10 MB

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub chat_id: Uuid,
    pub workspace_id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/chats/:id/attachments", post(upload))
        .route("/chats/:id/attachments/:aid", delete(remove))
}

async fn upload(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(chat_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Attachment>), AppError> {
    sqlx::query("SELECT id FROM chats WHERE id=$1 AND workspace_id=$2")
        .bind(chat_id)
        .bind(auth.workspace_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::not_found("Chat nao encontrado"))?;

    let field = multipart
        .next_field()
        .await
        .map_err(|_| AppError::bad_request("Erro ao ler multipart"))?
        .ok_or_else(|| AppError::bad_request("Nenhum arquivo enviado"))?;

    let filename = field.file_name().unwrap_or("arquivo").to_string();
    let mime_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();

    let bytes = field
        .bytes()
        .await
        .map_err(|_| AppError::bad_request("Erro ao ler bytes do arquivo"))?;

    if bytes.len() > MAX_FILE_BYTES {
        return Err(AppError::bad_request("Arquivo excede 10 MB"));
    }

    let extracted_text = extract_text(&mime_type, &filename, &bytes);

    let row = sqlx::query_as::<_, Attachment>(
        "INSERT INTO chat_attachments (chat_id, workspace_id, filename, mime_type, size_bytes, extracted_text)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, chat_id, workspace_id, filename, mime_type, size_bytes, created_at",
    )
    .bind(chat_id)
    .bind(auth.workspace_id)
    .bind(&filename)
    .bind(&mime_type)
    .bind(bytes.len() as i64)
    .bind(extracted_text.as_deref())
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(row)))
}

async fn remove(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path((chat_id, aid)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    sqlx::query("SELECT id FROM chats WHERE id=$1 AND workspace_id=$2")
        .bind(chat_id)
        .bind(auth.workspace_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::not_found("Chat nao encontrado"))?;

    let r = sqlx::query("DELETE FROM chat_attachments WHERE id=$1 AND chat_id=$2")
        .bind(aid)
        .bind(chat_id)
        .execute(&state.db)
        .await?;

    if r.rows_affected() == 0 {
        return Err(AppError::not_found("Anexo nao encontrado"));
    }
    Ok(StatusCode::NO_CONTENT)
}

fn extract_text(mime: &str, filename: &str, bytes: &[u8]) -> Option<String> {
    let ext = filename.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "txt" | "md" | "csv" => Some(String::from_utf8_lossy(bytes).into_owned()),
        "pdf" => pdf_extract::extract_text_from_mem(bytes).ok(),
        "docx" => extract_docx_text(bytes),
        _ if mime.starts_with("text/") => Some(String::from_utf8_lossy(bytes).into_owned()),
        _ => None,
    }
}

fn extract_docx_text(bytes: &[u8]) -> Option<String> {
    use std::io::Read;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).ok()?;
    let mut file = archive.by_name("word/document.xml").ok()?;
    let mut xml = String::new();
    file.read_to_string(&mut xml).ok()?;
    let text = strip_xml_tags(&xml);
    if text.is_empty() { None } else { Some(text) }
}

fn strip_xml_tags(xml: &str) -> String {
    let mut result = String::with_capacity(xml.len() / 2);
    let mut in_tag = false;
    for ch in xml.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => { in_tag = false; result.push(' '); }
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    result.split_whitespace().collect::<Vec<_>>().join(" ")
}
