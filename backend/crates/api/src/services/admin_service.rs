//! AdminService: health, metrics, AI/LoRA config, API keys, webhooks,
//! resource limits, settings, branding, retention e data export.
//!
//! Sprint 2 — Grupo B: extraído do monolito `routes/admin.rs`.
//! Cada método delega para queries SQL (via `db`) ou endpoints externos.

use sqlx::PgPool;
use uuid::Uuid;
use anyhow::Result;

use crate::models::admin::*;

#[derive(Clone)]
pub struct AdminService {
    pub db: PgPool,
    pub ollama_url: String,
    pub qdrant_url: String,
    pub embedding_url: String,
}

impl AdminService {
    pub fn new(db: PgPool, ollama_url: String, qdrant_url: String, embedding_url: String) -> Self {
        Self { db, ollama_url, qdrant_url, embedding_url }
    }

    // ── Health ──────────────────────────────────────────────────────────────

    pub async fn get_system_health(&self) -> Result<SystemHealth> {
        let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
            .fetch_one(&self.db).await.is_ok();
        Ok(SystemHealth {
            status: if db_ok { "healthy".into() } else { "degraded".into() },
            api: true,
            database: db_ok,
            vector_db: false, // TODO: ping Qdrant
            gpu: false,       // TODO: ping Ollama
            embedding: false, // TODO: ping embedding service
            uptime_percent: 99.9,
            avg_latency_ms: 0,
        })
    }

    pub async fn get_gpu_status(&self) -> Result<GpuInfo> {
        // TODO: chamar GET {ollama_url}/api/ps e parsear resposta
        Ok(GpuInfo {
            model: "N/A".into(),
            utilization: 0,
            vram_used: 0.0,
            vram_total: 0.0,
            vram_percent: 0.0,
            temperature: 0,
            requests_per_min: 0,
            active_model: self.ollama_url.clone(),
            active_lora_version: None,
            provider: "ollama".into(),
        })
    }

    pub async fn get_pending_alerts(&self) -> Result<Vec<AdminAlert>> {
        // TODO: query tabela admin_alerts WHERE resolved_at IS NULL
        Ok(vec![])
    }

    // ── Metrics ─────────────────────────────────────────────────────────────

    pub async fn get_usage_metrics(&self, period: &str) -> Result<UsageMetrics> {
        let interval = period_to_interval(period);
        let row = sqlx::query_as::<_, UsageMetricsRow>(
            r#"SELECT
                COALESCE(SUM(tokens_input),0)      AS total_tokens_input,
                COALESCE(SUM(tokens_output),0)     AS total_tokens_output,
                COALESCE(SUM(tokens_embedding),0)  AS total_tokens_embedding,
                COALESCE(COUNT(*),0)               AS total_chat_requests,
                COALESCE(SUM(rag_queries),0)       AS total_rag_queries,
                COALESCE(SUM(docs_processed),0)    AS total_documents_processed,
                COUNT(DISTINCT user_id)            AS active_users
            FROM usage_events
            WHERE created_at >= NOW() - CAST($1 AS INTERVAL)"""
        ),
        ).bind(interval).fetch_one(&self.db).await
            .unwrap_or_else(|_| UsageMetricsRow {
                total_tokens_input: 0, total_tokens_output: 0,
                total_tokens_embedding: 0, total_chat_requests: 0,
                total_rag_queries: 0, total_documents_processed: 0,
                active_users: 0,
            });
        let cost = EstimatedCost { gpu: 0.0, storage: 0.0, network: 0.0, total: 0.0, currency: "USD".into() };
        Ok(row.into_metrics(period, cost))
    }

    pub async fn get_daily_metrics(&self, period: &str) -> Result<Vec<DailyMetric>> {
        let interval = period_to_interval(period);
        let rows = sqlx::query_as::<_, DailyMetric>(
            r#"SELECT
                DATE_TRUNC('day', created_at) AS date,
                COUNT(*) AS messages,
                COALESCE(SUM(tokens_input + tokens_output), 0) AS tokens,
                COUNT(DISTINCT user_id) AS users,
                COALESCE(SUM(docs_processed), 0) AS documents
            FROM usage_events
            WHERE created_at >= NOW() - CAST($1 AS INTERVAL)
            GROUP BY 1 ORDER BY 1"""
        ).bind(interval).fetch_all(&self.db).await.unwrap_or_default();
        Ok(rows)
    }

    pub async fn get_top_projects(&self, limit: i64) -> Result<Vec<ProjectMetric>> {
        let rows = sqlx::query_as::<_, ProjectMetric>(
            r#"SELECT p.id, p.name, p.color, p.icon,
                COUNT(DISTINCT c.id) AS chat_count,
                COUNT(DISTINCT d.id) AS doc_count,
                COALESCE(SUM(u.tokens_input + u.tokens_output), 0) AS tokens_used,
                NULL::float8 AS avg_quality
            FROM projects p
            LEFT JOIN chats c ON c.project_id = p.id
            LEFT JOIN documents d ON d.project_id = p.id
            LEFT JOIN usage_events u ON u.project_id = p.id
            GROUP BY p.id ORDER BY tokens_used DESC LIMIT $1"""
        ).bind(limit).fetch_all(&self.db).await.unwrap_or_default();
        Ok(rows)
    }

    pub async fn get_top_users(&self, limit: i64) -> Result<Vec<UserMetric>> {
        let rows = sqlx::query_as::<_, UserMetric>(
            r#"SELECT u.id, u.name,
                COUNT(DISTINCT m.id) AS message_count,
                COUNT(DISTINCT f.id) AS feedback_count,
                MAX(u.last_active_at) AS last_active_at
            FROM users u
            LEFT JOIN messages m ON m.user_id = u.id
            LEFT JOIN feedbacks f ON f.user_id = u.id
            GROUP BY u.id ORDER BY message_count DESC LIMIT $1"""
        ).bind(limit).fetch_all(&self.db).await.unwrap_or_default();
        Ok(rows)
    }

    pub async fn export_metrics_csv(&self, period: &str) -> Result<String> {
        let metrics = self.get_daily_metrics(period).await?;
        let mut csv = "date,messages,tokens,users,documents\n".to_string();
        for m in metrics {
            csv.push_str(&format!("{},{},{},{},{}\n",
                m.date, m.messages, m.tokens, m.users, m.documents));
        }
        Ok(csv)
    }

    // ── AI Config ────────────────────────────────────────────────────────────

    pub async fn list_models(&self) -> Result<Vec<AiModelConfig>> {
        let rows = sqlx::query_as::<_, AiModelConfig>(
            "SELECT * FROM ai_models ORDER BY display_name"
        ).fetch_all(&self.db).await.unwrap_or_default();
        Ok(rows)
    }

    pub async fn update_model_config(&self, id: &str, body: serde_json::Value) -> Result<()> {
        sqlx::query(
            "UPDATE ai_models SET default_temperature=$1, default_max_tokens=$2 WHERE id=$3"
        )
        .bind(body["default_temperature"].as_f64().unwrap_or(0.7))
        .bind(body["default_max_tokens"].as_i64().unwrap_or(2048) as i32)
        .bind(id)
        .execute(&self.db).await?;
        Ok(())
    }

    pub async fn list_lora_adapters(&self) -> Result<Vec<LoraAdapter>> {
        let rows = sqlx::query_as::<_, LoraAdapter>(
            "SELECT * FROM lora_adapters ORDER BY trained_at DESC"
        ).fetch_all(&self.db).await.unwrap_or_default();
        Ok(rows)
    }

    pub async fn deploy_lora(&self, version: &str) -> Result<()> {
        sqlx::query(
            "UPDATE lora_adapters SET status='active', deployed_at=NOW() WHERE version=$1"
        ).bind(version).execute(&self.db).await?;
        Ok(())
    }

    pub async fn rollback_lora(&self, version: &str) -> Result<()> {
        sqlx::query(
            "UPDATE lora_adapters SET status='inactive', deployed_at=NULL WHERE version=$1"
        ).bind(version).execute(&self.db).await?;
        Ok(())
    }

    pub async fn start_training_batch(&self) -> Result<TrainingBatch> {
        let row = sqlx::query_as::<_, TrainingBatch>(
            r#"INSERT INTO training_batches (status, created_at)
               VALUES ('pending', NOW()) RETURNING *"""
        ).fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn get_latest_training_batch(&self) -> Result<TrainingBatch> {
        let row = sqlx::query_as::<_, TrainingBatch>(
            "SELECT * FROM training_batches ORDER BY created_at DESC LIMIT 1"
        ).fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn get_rag_config(&self) -> Result<RagConfig> {
        let row = sqlx::query_as::<_, RagConfig>(
            "SELECT top_k, chunk_size, chunk_overlap, similarity_threshold FROM rag_config LIMIT 1"
        ).fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn update_rag_config(&self, config: RagConfig) -> Result<()> {
        sqlx::query(
            "UPDATE rag_config SET top_k=$1, chunk_size=$2, chunk_overlap=$3, similarity_threshold=$4"
        )
        .bind(config.top_k).bind(config.chunk_size)
        .bind(config.chunk_overlap).bind(config.similarity_threshold)
        .execute(&self.db).await?;
        Ok(())
    }

    // ── API Keys ─────────────────────────────────────────────────────────────

    pub async fn list_api_keys(&self) -> Result<Vec<ApiKeyRow>> {
        let rows = sqlx::query_as::<_, ApiKeyRow>(
            "SELECT * FROM api_keys ORDER BY created_at DESC"
        ).fetch_all(&self.db).await.unwrap_or_default();
        Ok(rows)
    }

    pub async fn create_api_key(
        &self,
        name: &str,
        permissions: &[String],
        rate_limit: i32,
        expires_at: Option<&str>,
    ) -> Result<(ApiKeyRow, String)> {
        use rand::Rng;
        let raw: String = rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(40).map(char::from).collect();
        let prefix = &raw[..8];
        let masked = format!("{}...{}", &raw[..8], &raw[raw.len()-4..]);
        let hashed = sha256_hex(&raw);
        let perms = serde_json::to_value(permissions).unwrap_or_default();
        let row = sqlx::query_as::<_, ApiKeyRow>(
            r#"INSERT INTO api_keys
               (name, prefix, masked_key, key_hash, permissions, rate_limit, expires_at, status, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,'active',NOW())
               RETURNING *"""
        )
        .bind(name).bind(prefix).bind(&masked).bind(&hashed)
        .bind(&perms).bind(rate_limit).bind(expires_at)
        .fetch_one(&self.db).await?;
        Ok((row, raw))
    }

    pub async fn update_api_key(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query("UPDATE api_keys SET name=$1, rate_limit=$2 WHERE id=$3")
            .bind(body["name"].as_str().unwrap_or(""))
            .bind(body["rate_limit"].as_i64().unwrap_or(60) as i32)
            .bind(id)
            .execute(&self.db).await?;
        Ok(())
    }

    pub async fn delete_api_key(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM api_keys WHERE id=$1").bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn revoke_api_key(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE api_keys SET status='revoked', revoked_at=NOW() WHERE id=$1")
            .bind(id).execute(&self.db).await?;
        Ok(())
    }

    // ── Webhooks ─────────────────────────────────────────────────────────────

    pub async fn list_webhooks(&self) -> Result<Vec<WebhookRow>> {
        Ok(sqlx::query_as::<_, WebhookRow>("SELECT * FROM webhooks ORDER BY created_at DESC")
            .fetch_all(&self.db).await.unwrap_or_default())
    }

    pub async fn get_webhook(&self, id: Uuid) -> Result<WebhookRow> {
        Ok(sqlx::query_as::<_, WebhookRow>("SELECT * FROM webhooks WHERE id=$1")
            .bind(id).fetch_one(&self.db).await?)
    }

    pub async fn create_webhook(&self, body: serde_json::Value) -> Result<WebhookRow> {
        Ok(sqlx::query_as::<_, WebhookRow>(
            r#"INSERT INTO webhooks (name, url, secret, events, status, retry_policy, timeout_ms, created_at)
               VALUES ($1,$2,$3,$4,'active','exponential',5000,NOW()) RETURNING *"""
        )
        .bind(body["name"].as_str().unwrap_or(""))
        .bind(body["url"].as_str().unwrap_or(""))
        .bind(body["secret"].as_str().unwrap_or(""))
        .bind(body.get("events").cloned().unwrap_or_default())
        .fetch_one(&self.db).await?)
    }

    pub async fn update_webhook(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query("UPDATE webhooks SET name=$1, url=$2, events=$3 WHERE id=$4")
            .bind(body["name"].as_str().unwrap_or(""))
            .bind(body["url"].as_str().unwrap_or(""))
            .bind(body.get("events").cloned().unwrap_or_default())
            .bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn delete_webhook(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM webhooks WHERE id=$1").bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn test_webhook(&self, _id: Uuid) -> Result<()> {
        // TODO: disparar HTTP POST test no endpoint do webhook
        Ok(())
    }

    pub async fn set_webhook_status(&self, id: Uuid, status: &str) -> Result<()> {
        sqlx::query("UPDATE webhooks SET status=$1 WHERE id=$2")
            .bind(status).bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn list_webhook_deliveries(
        &self, webhook_id: Uuid, page: i64, per_page: i64, status: Option<&str>,
    ) -> Result<Vec<WebhookDelivery>> {
        let offset = (page - 1) * per_page;
        let rows = match status {
            Some(s) => sqlx::query_as::<_, WebhookDelivery>(
                "SELECT * FROM webhook_deliveries WHERE webhook_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
            ).bind(webhook_id).bind(s).bind(per_page).bind(offset).fetch_all(&self.db).await,
            None => sqlx::query_as::<_, WebhookDelivery>(
                "SELECT * FROM webhook_deliveries WHERE webhook_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
            ).bind(webhook_id).bind(per_page).bind(offset).fetch_all(&self.db).await,
        }.unwrap_or_default();
        Ok(rows)
    }

    pub async fn retry_webhook_delivery(&self, _webhook_id: Uuid, delivery_id: Uuid) -> Result<()> {
        sqlx::query("UPDATE webhook_deliveries SET status='pending', next_retry_at=NOW() WHERE id=$1")
            .bind(delivery_id).execute(&self.db).await?;
        Ok(())
    }

    // ── Resource Limits ──────────────────────────────────────────────────────

    pub async fn list_resource_limits(&self) -> Result<Vec<ResourceLimitRow>> {
        Ok(sqlx::query_as::<_, ResourceLimitRow>("SELECT * FROM resource_limits ORDER BY type, target_name")
            .fetch_all(&self.db).await.unwrap_or_default())
    }

    pub async fn create_resource_limit(&self, body: serde_json::Value) -> Result<ResourceLimitRow> {
        Ok(sqlx::query_as::<_, ResourceLimitRow>(
            r#"INSERT INTO resource_limits (type, target_name, max_tokens_per_day, max_messages_per_day,
               max_documents_total, max_storage_gb, max_api_requests_per_min,
               current_tokens_today, current_messages_today, current_documents_total,
               current_storage_gb, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,0.0,NOW()) RETURNING *"""
        )
        .bind(body["type"].as_str().unwrap_or(""))
        .bind(body["target_name"].as_str().unwrap_or(""))
        .bind(body["max_tokens_per_day"].as_i64())
        .bind(body["max_messages_per_day"].as_i64())
        .bind(body["max_documents_total"].as_i64())
        .bind(body["max_storage_gb"].as_f64())
        .bind(body["max_api_requests_per_min"].as_i64())
        .fetch_one(&self.db).await?)
    }

    pub async fn update_resource_limit(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query(
            "UPDATE resource_limits SET max_tokens_per_day=$1, max_messages_per_day=$2, updated_at=NOW() WHERE id=$3"
        )
        .bind(body["max_tokens_per_day"].as_i64())
        .bind(body["max_messages_per_day"].as_i64())
        .bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn delete_resource_limit(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM resource_limits WHERE id=$1").bind(id).execute(&self.db).await?;
        Ok(())
    }

    // ── Settings ─────────────────────────────────────────────────────────────

    pub async fn get_settings(&self) -> Result<WorkspaceSettings> {
        Ok(sqlx::query_as::<_, WorkspaceSettings>("SELECT * FROM workspace_settings LIMIT 1")
            .fetch_one(&self.db).await?)
    }

    pub async fn update_settings(&self, s: WorkspaceSettings) -> Result<()> {
        sqlx::query(
            r#"UPDATE workspace_settings SET name=$1, slug=$2, timezone=$3, language=$4,
               session_timeout_minutes=$5, max_concurrent_sessions=$6, mfa_required=$7,
               notify_on_new_user=$8, notify_on_training_complete=$9, notify_on_security_event=$10,
               notification_email=$11, allow_user_self_registration=$12"""
        )
        .bind(&s.name).bind(&s.slug).bind(&s.timezone).bind(&s.language)
        .bind(s.session_timeout_minutes).bind(s.max_concurrent_sessions).bind(s.mfa_required)
        .bind(s.notify_on_new_user).bind(s.notify_on_training_complete).bind(s.notify_on_security_event)
        .bind(&s.notification_email).bind(s.allow_user_self_registration)
        .execute(&self.db).await?;
        Ok(())
    }

    // ── Branding ─────────────────────────────────────────────────────────────

    pub async fn get_branding(&self) -> Result<BrandingConfig> {
        Ok(sqlx::query_as::<_, BrandingConfig>("SELECT * FROM branding_config LIMIT 1")
            .fetch_one(&self.db).await?)
    }

    pub async fn update_branding(&self, b: BrandingConfig) -> Result<()> {
        sqlx::query(
            r#"UPDATE branding_config SET product_name=$1, tagline=$2, primary_color=$3,
               secondary_color=$4, accent_color=$5, bg_color=$6, surface_color=$7,
               text_color=$8, font_family=$9, show_powered_by=$10,
               terms_url=$11, privacy_url=$12, support_email=$13, features=$14"""
        )
        .bind(&b.product_name).bind(&b.tagline).bind(&b.primary_color)
        .bind(&b.secondary_color).bind(&b.accent_color).bind(&b.bg_color)
        .bind(&b.surface_color).bind(&b.text_color).bind(&b.font_family)
        .bind(b.show_powered_by).bind(&b.terms_url).bind(&b.privacy_url)
        .bind(&b.support_email).bind(&b.features)
        .execute(&self.db).await?;
        Ok(())
    }

    pub async fn verify_domain(&self, domain: &str) -> Result<String> {
        // TODO: verificar registro TXT DNS e atualizar custom_domain_status
        sqlx::query("UPDATE branding_config SET custom_domain=$1, custom_domain_status='pending'")
            .bind(domain).execute(&self.db).await?;
        Ok("pending".to_string())
    }

    // ── Export / API Docs ────────────────────────────────────────────────────

    pub async fn export_all_data(&self) -> Result<Vec<u8>> {
        // TODO: gerar ZIP com tabelas exportadas
        Ok(vec![])
    }

    pub async fn list_api_endpoints(&self) -> Result<Vec<ApiEndpointDoc>> {
        Ok(vec![])
    }

    pub async fn get_openapi_spec(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({ "openapi": "3.1.0", "info": { "title": "BTV Chat Corp API", "version": "2.0.0" } }))
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn period_to_interval(period: &str) -> &'static str {
    match period {
        "7d"  => "7 days",
        "90d" => "90 days",
        _     => "30 days",
    }
}

fn sha256_hex(s: &str) -> String {
    use std::fmt::Write;
    let hash = <sha2::Sha256 as sha2::Digest>::digest(s.as_bytes());
    hash.iter().fold(String::new(), |mut out, b| { write!(out, "{:02x}", b).ok(); out })
}
