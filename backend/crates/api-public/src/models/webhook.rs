use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateWebhookRequest {
    pub name: String,
    pub url: String,
    pub description: Option<String>,
    pub events: Vec<String>,
    pub secret: Option<String>,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub timeout_secs: Option<i32>,
    pub max_retries: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWebhookRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub events: Option<Vec<String>>,
    pub status: Option<String>,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub timeout_secs: Option<i32>,
    pub max_retries: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct WebhookResponse {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub description: Option<String>,
    pub events: Vec<String>,
    pub status: String,
    pub consecutive_failures: i32,
    pub last_delivery_at: Option<String>,
    pub last_delivery_status: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct WebhookDeliveryResponse {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event_type: String,
    pub status: String,
    pub attempt_number: i32,
    pub http_status: Option<i32>,
    pub response_time_ms: Option<i64>,
    pub error_message: Option<String>,
    pub scheduled_at: String,
    pub delivered_at: Option<String>,
    pub next_retry_at: Option<String>,
}
