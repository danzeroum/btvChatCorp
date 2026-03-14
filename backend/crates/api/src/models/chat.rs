use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct Chat {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub project_id: Option<Uuid>,
    pub title: String,
    pub summary: Option<String>,
    pub is_pinned: Option<bool>,
    pub created_by: Option<Uuid>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct Message {
    pub id: Uuid,
    pub chat_id: Uuid,
    /// "user" ou "assistant"
    pub role: String,
    pub content: String,
    pub sources: Option<serde_json::Value>,
    pub tokens_used: Option<i32>,
    pub feedback: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateChatDto {
    pub title: Option<String>,
    pub project_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SendMessageDto {
    /// Conteudo da mensagem do usuario
    pub content: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct FeedbackDto {
    /// 1 = positivo, -1 = negativo
    pub feedback: i32,
}
