use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Document {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub file_hash: String,
    pub storage_path: String,
    pub processing_status: String,
    pub page_count: Option<i32>,
    pub chunk_count: Option<i32>,
    pub uploaded_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
