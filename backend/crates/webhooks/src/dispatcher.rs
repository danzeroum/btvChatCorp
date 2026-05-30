use reqwest::Client;
use tokio::sync::mpsc;

use crate::events::{WebhookEvent, WebhookPayload};
use crate::signer::sign_payload;
use crate::store::{WebhookConfig, WebhookStore};

/// Despacha eventos para os endpoints registrados, de forma assíncrona.
///
/// `dispatch` é fire-and-forget: o evento é enfileirado e entregue em background
/// por um worker com retry exponencial.
#[derive(Clone)]
pub struct WebhookDispatcher {
    sender: mpsc::Sender<WebhookEvent>,
}

impl WebhookDispatcher {
    pub fn new(store: WebhookStore) -> Self {
        let (tx, rx) = mpsc::channel::<WebhookEvent>(1000);
        tokio::spawn(Self::process_events(store, rx));
        Self { sender: tx }
    }

    /// Publica evento de forma não-bloqueante (fire-and-forget)
    pub async fn dispatch(&self, event: WebhookEvent) {
        let _ = self.sender.send(event).await;
    }

    /// Worker que processa eventos em background
    async fn process_events(store: WebhookStore, mut receiver: mpsc::Receiver<WebhookEvent>) {
        while let Some(event) = receiver.recv().await {
            let store = store.clone();
            tokio::spawn(async move {
                let event_type = event.event_type.to_string();
                let webhooks = match store
                    .get_matching_webhooks(&event.workspace_id, &event_type)
                    .await
                {
                    Ok(w) => w,
                    Err(e) => {
                        tracing::error!("Failed to load webhooks: {}", e);
                        return;
                    }
                };

                for webhook in webhooks {
                    let payload = WebhookPayload::new(&event, 1);
                    let delivery_id = payload.id.clone();
                    Self::deliver_with_retry(&store, &webhook, payload, &delivery_id).await;
                }
            });
        }
    }

    /// Retry exponencial: 0s → 30s → 5min → 30min → 2h
    async fn deliver_with_retry(
        store: &WebhookStore,
        webhook: &WebhookConfig,
        mut payload: WebhookPayload,
        delivery_id: &str,
    ) {
        let delays = [0u64, 30, 300, 1800, 7200];
        let client = Client::new();

        for (attempt, delay) in delays.iter().enumerate() {
            if *delay > 0 {
                tokio::time::sleep(std::time::Duration::from_secs(*delay)).await;
            }

            payload.delivery_attempt = (attempt + 1) as u32;

            let body = serde_json::to_vec(&payload).unwrap_or_default();
            let signature = sign_payload(&webhook.secret, &body);

            let result = client
                .post(&webhook.url)
                .header("Content-Type", "application/json")
                .header("X-Webhook-Signature", &signature)
                .header("X-Webhook-ID", delivery_id)
                .timeout(std::time::Duration::from_secs(
                    webhook.timeout_secs.max(0) as u64
                ))
                .body(body)
                .send()
                .await;

            match result {
                Ok(resp) if resp.status().is_success() => {
                    store
                        .record_delivery(
                            delivery_id,
                            webhook.id,
                            "success",
                            resp.status().as_u16(),
                            attempt + 1,
                        )
                        .await
                        .ok();
                    return;
                }
                _ if attempt == delays.len() - 1 => {
                    store
                        .record_delivery(delivery_id, webhook.id, "failed", 0, attempt + 1)
                        .await
                        .ok();
                    store.increment_failure_count(webhook.id).await.ok();
                    return;
                }
                _ => continue,
            }
        }
    }
}
