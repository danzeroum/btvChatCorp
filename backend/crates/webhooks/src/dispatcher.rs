use std::sync::Arc;
use tokio::sync::mpsc;
use reqwest::Client;
use serde::{Serialize, Deserialize};
use hmac::{Hmac, Mac};
use sha2::Sha256;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    pub workspace_id: String,
    pub event_type: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebhookPayload {
    pub id: String,
    pub event_type: String,
    pub timestamp: String,
    pub workspace_id: String,
    pub api_version: String,
    pub delivery_attempt: u32,
    pub data: serde_json::Value,
}

#[derive(Clone)]
pub struct WebhookDispatcher {
    sender: mpsc::Sender<WebhookEvent>,
}

impl WebhookDispatcher {
    pub fn new(db: Arc<DatabasePool>) -> Self {
        let (tx, rx) = mpsc::channel::<WebhookEvent>(1000);
        let db_clone = db.clone();

        tokio::spawn(Self::process_events(db_clone, rx));

        Self { sender: tx }
    }

    /// Publica evento de forma não-bloqueante (fire-and-forget)
    pub async fn dispatch(&self, event: WebhookEvent) {
        let _ = self.sender.send(event).await;
    }

    /// Worker que processa eventos em background
    async fn process_events(
        db: Arc<DatabasePool>,
        mut receiver: mpsc::Receiver<WebhookEvent>,
    ) {
        while let Some(event) = receiver.recv().await {
            let db = db.clone();
            tokio::spawn(async move {
                let webhooks = db
                    .get_matching_webhooks(&event.workspace_id, &event.event_type)
                    .await
                    .unwrap_or_default();

                for webhook in webhooks {
                    let delivery_id = uuid::Uuid::new_v4().to_string();
                    let payload = WebhookPayload {
                        id: delivery_id.clone(),
                        event_type: event.event_type.clone(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        workspace_id: event.workspace_id.clone(),
                        api_version: "2026-01-01".into(),
                        delivery_attempt: 1,
                        data: event.data.clone(),
                    };

                    Self::deliver_with_retry(&db, &webhook, payload, &delivery_id).await;
                }
            });
        }
    }

    /// Retry exponencial: 0s → 30s → 5min → 30min → 2h
    async fn deliver_with_retry(
        db: &Arc<DatabasePool>,
        webhook: &WebhookConfig,
        mut payload: WebhookPayload,
        delivery_id: &str,
    ) {
        let delays = [0u64, 30, 300, 1800, 7200];

        for (attempt, delay) in delays.iter().enumerate() {
            if *delay > 0 {
                tokio::time::sleep(std::time::Duration::from_secs(*delay)).await;
            }

            payload.delivery_attempt = (attempt + 1) as u32;

            let signature = sign_payload(&webhook.secret, &payload);
            let client = Client::new();

            let result = client
                .post(&webhook.url)
                .header("Content-Type", "application/json")
                .header("X-Webhook-Signature", &signature)
                .header("X-Webhook-ID", delivery_id)
                .timeout(std::time::Duration::from_secs(webhook.timeout_secs))
                .json(&payload)
                .send()
                .await;

            match result {
                Ok(resp) if resp.status().is_success() => {
                    db.record_delivery(delivery_id, "success", resp.status().as_u16(), attempt + 1)
                        .await
                        .ok();
                    return;
                }
                Err(_) if attempt == delays.len() - 1 => {
                    db.record_delivery(delivery_id, "failed", 0, attempt + 1)
                        .await
                        .ok();
                    db.increment_failure_count(&webhook.id).await.ok();
                    return;
                }
                _ => continue,
            }
        }
    }
}

/// Assina payload com HMAC-SHA256 para verificação pelo receptor
fn sign_payload(secret: &str, payload: &WebhookPayload) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let body = serde_json::to_string(payload).unwrap_or_default();
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(body.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

// Structs de suporte (implementadas no módulo de DB)
pub struct DatabasePool;
pub struct WebhookConfig {
    pub id: String,
    pub url: String,
    pub secret: String,
    pub timeout_secs: u64,
}
