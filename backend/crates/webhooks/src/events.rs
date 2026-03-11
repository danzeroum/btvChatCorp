use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Todos os tipos de eventos que a plataforma pode emitir via webhook.
/// O cliente registra quais eventos quer receber no endpoint.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum WebhookEventType {
    // Chat
    ChatCreated,
    ChatMessageSent,
    ChatMessageReceived,
    ChatCompleted,
    // Documents
    DocumentUploaded,
    DocumentProcessed,
    DocumentDeleted,
    DocumentProcessingFailed,
    // Projects
    ProjectCreated,
    ProjectUpdated,
    ProjectDeleted,
    ProjectMemberAdded,
    ProjectMemberRemoved,
    // Training
    TrainingFeedbackReceived,
    TrainingBatchStarted,
    TrainingBatchCompleted,
    TrainingBatchFailed,
    TrainingModelDeployed,
    // Connectors
    ConnectorSynced,
    ConnectorError,
    // Security
    SecurityPiiDetected,
    SecurityAccessDenied,
    UserLogin,
    UserCreated,
}

impl std::fmt::Display for WebhookEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = serde_json::to_string(self)
            .unwrap_or_default()
            .trim_matches('"')
            .to_string();
        write!(f, "{}", s)
    }
}

/// Evento interno publicado pelo serviço que gerou o evento.
/// O dispatcher consome esse struct e o transforma em `WebhookPayload`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    /// Tipo do evento
    pub event_type: WebhookEventType,
    /// ID do workspace que gerou o evento
    pub workspace_id: String,
    /// Payload específico do evento (livre)
    pub data: serde_json::Value,
    /// Metadados opcionais para filtragem (project_id, user_id, etc.)
    pub meta: Option<serde_json::Value>,
}

/// Payload assinado e enviado ao endpoint do cliente.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookPayload {
    /// ID único do evento (para dedup no cliente)
    pub id: String,
    /// Tipo do evento em snake_case
    #[serde(rename = "type")]
    pub event_type: String,
    /// Timestamp ISO 8601
    pub timestamp: DateTime<Utc>,
    /// Workspace que originou o evento
    pub workspace_id: String,
    /// Versão da API de webhooks
    pub api_version: String,
    /// Número da tentativa de entrega (1 = primeira)
    pub delivery_attempt: u32,
    /// Dados do evento
    pub data: serde_json::Value,
}

impl WebhookPayload {
    pub fn new(
        event: &WebhookEvent,
        delivery_attempt: u32,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            event_type: event.event_type.to_string(),
            timestamp: Utc::now(),
            workspace_id: event.workspace_id.clone(),
            api_version: "2026-01-01".into(),
            delivery_attempt,
            data: event.data.clone(),
        }
    }
}
