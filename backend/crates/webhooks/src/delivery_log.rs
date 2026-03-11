use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Status possível de uma tentativa de entrega
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryStatus {
    Pending,
    Delivered,
    Failed,
    Retrying,
}

impl std::fmt::Display for DeliveryStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            DeliveryStatus::Pending => "pending",
            DeliveryStatus::Delivered => "delivered",
            DeliveryStatus::Failed => "failed",
            DeliveryStatus::Retrying => "retrying",
        };
        write!(f, "{}", s)
    }
}

/// Registro de uma tentativa de entrega de webhook
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRecord {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub status: DeliveryStatus,
    pub attempt_number: u32,
    pub http_status: Option<u16>,
    pub response_body: Option<String>,
    pub response_time_ms: Option<u64>,
    pub error_message: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl DeliveryRecord {
    /// Cria novo registro de entrega (tentativa inicial)
    pub fn new_attempt(
        webhook_id: Uuid,
        event_type: String,
        payload: serde_json::Value,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            webhook_id,
            event_type,
            payload,
            status: DeliveryStatus::Pending,
            attempt_number: 1,
            http_status: None,
            response_body: None,
            response_time_ms: None,
            error_message: None,
            scheduled_at: now,
            delivered_at: None,
            next_retry_at: None,
            created_at: now,
        }
    }

    /// Marca como entregue com sucesso
    pub fn mark_delivered(mut self, http_status: u16, response_ms: u64) -> Self {
        self.status = DeliveryStatus::Delivered;
        self.http_status = Some(http_status);
        self.response_time_ms = Some(response_ms);
        self.delivered_at = Some(Utc::now());
        self
    }

    /// Marca como falha e agenda retry
    pub fn mark_failed(
        mut self,
        error: String,
        http_status: Option<u16>,
        next_retry: Option<DateTime<Utc>>,
    ) -> Self {
        self.status = if next_retry.is_some() {
            DeliveryStatus::Retrying
        } else {
            DeliveryStatus::Failed
        };
        self.error_message = Some(error);
        self.http_status = http_status;
        self.next_retry_at = next_retry;
        self
    }
}
