use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Chat {
    pub id:           Uuid,
    pub workspace_id: Uuid,
    pub project_id:   Option<Uuid>,
    pub title:        String,
    pub summary:      Option<String>,
    pub is_pinned:    bool,
    pub created_by:   Uuid,
    pub created_at:   DateTime<Utc>,
    pub updated_at:   DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Message {
    pub id:          Uuid,
    pub chat_id:     Uuid,
    pub role:        String,
    pub content:     String,
    pub sources:     Option<serde_json::Value>,
    pub tokens_used: Option<i32>,
    pub feedback:    Option<i16>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChatDto {
    pub project_id: Option<Uuid>,
    pub title:      Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageDto {
    pub content:     String,
    pub stream:      Option<bool>,
    pub temperature: Option<f32>,
    pub max_tokens:  Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct FeedbackDto {
    pub feedback: i16,  // 1 ou -1
}
