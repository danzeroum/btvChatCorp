use sqlx::PgPool;
use uuid::Uuid;

/// Configuração de um webhook registrado (subset usado para entrega).
#[derive(Debug, Clone)]
pub struct WebhookConfig {
    pub id: Uuid,
    pub url: String,
    pub secret: String,
    pub timeout_secs: i64,
}

/// Camada de acesso a dados dos webhooks (Postgres).
///
/// Substitui o antigo placeholder `DatabasePool` com queries reais
/// verificadas em tempo de compilação pelo sqlx.
#[derive(Clone)]
pub struct WebhookStore {
    pool: PgPool,
}

impl WebhookStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Retorna os webhooks ativos do workspace inscritos no tipo de evento dado.
    /// Usa containment JSONB (`@>`) para checar se o array `events` contém o tipo.
    pub async fn get_matching_webhooks(
        &self,
        workspace_id: &str,
        event_type: &str,
    ) -> Result<Vec<WebhookConfig>, sqlx::Error> {
        let ws = Uuid::parse_str(workspace_id).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

        let rows = sqlx::query!(
            r#"
            SELECT id, url, secret, timeout_secs
            FROM webhooks
            WHERE workspace_id = $1
              AND status = 'active'
              AND events @> to_jsonb($2::text)
            "#,
            ws,
            event_type,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| WebhookConfig {
                id: r.id,
                url: r.url,
                secret: r.secret,
                timeout_secs: r.timeout_secs,
            })
            .collect())
    }

    /// Registra (ou atualiza) o resultado de uma tentativa de entrega.
    pub async fn record_delivery(
        &self,
        delivery_id: &str,
        webhook_id: Uuid,
        status: &str,
        status_code: u16,
        attempt: usize,
    ) -> Result<(), sqlx::Error> {
        let id = Uuid::parse_str(delivery_id).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

        sqlx::query!(
            r#"
            INSERT INTO webhook_deliveries (id, webhook_id, status, http_status, attempt_number)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE
                SET status         = EXCLUDED.status,
                    http_status    = EXCLUDED.http_status,
                    attempt_number = EXCLUDED.attempt_number
            "#,
            id,
            webhook_id,
            status,
            status_code as i32,
            attempt as i32,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Incrementa o contador de falhas consecutivas de um webhook.
    pub async fn increment_failure_count(&self, webhook_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE webhooks SET consecutive_failures = consecutive_failures + 1 WHERE id = $1",
            webhook_id,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
