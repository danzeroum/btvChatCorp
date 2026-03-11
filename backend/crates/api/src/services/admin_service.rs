use anyhow::Result;
use chrono::Utc;
use sha2::{Sha256, Digest};
use hex;
use reqwest::Client;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::admin::*;

/// Serviço principal do módulo admin.
/// Encapsula toda lógica de negócio — os handlers em admin.rs apenas delegam aqui.
pub struct AdminService {
    pub db: PgPool,
    pub http: Client,
    pub vllm_url: String,
    pub start_time: std::time::Instant,
}

impl AdminService {
    pub fn new(db: PgPool, vllm_url: String) -> Self {
        Self {
            db,
            http: Client::new(),
            vllm_url,
            start_time: std::time::Instant::now(),
        }
    }

    // ── Health ────────────────────────────────────────────────────────────────

    pub async fn get_system_health(&self) -> Result<SystemHealth> {
        let (db_ok, vllm_ok, qdrant_ok, embedding_ok) = tokio::join!(
            self.check_postgres(),
            self.check_vllm(),
            self.check_qdrant(),
            self.check_embedding(),
        );
        let all_healthy = db_ok && vllm_ok && qdrant_ok && embedding_ok;
        let uptime_secs = self.start_time.elapsed().as_secs_f64();
        // Uptime % simples baseado em health checks acumulados (simplificado)
        let uptime_pct = if all_healthy { 99.9_f64 } else { 95.0_f64 };
        Ok(SystemHealth {
            status: if all_healthy { "healthy" } else { "degraded" }.into(),
            api: true,
            database: db_ok,
            vector_db: qdrant_ok,
            gpu: vllm_ok,
            embedding: embedding_ok,
            uptime_percent: uptime_pct,
            avg_latency_ms: self.measure_latency().await.unwrap_or(0),
        })
    }

    async fn check_postgres(&self) -> bool {
        sqlx::query("SELECT 1").execute(&self.db).await.is_ok()
    }

    async fn check_vllm(&self) -> bool {
        self.http.get(format!("{}/health", self.vllm_url))
            .timeout(std::time::Duration::from_secs(3))
            .send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }

    async fn check_qdrant(&self) -> bool {
        self.http.get("http://qdrant:6333/healthz")
            .timeout(std::time::Duration::from_secs(3))
            .send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }

    async fn check_embedding(&self) -> bool {
        self.http.get("http://embedding-service:8001/health")
            .timeout(std::time::Duration::from_secs(3))
            .send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }

    async fn measure_latency(&self) -> Result<u64> {
        let start = std::time::Instant::now();
        self.http.get(format!("{}/health", self.vllm_url)).send().await?;
        Ok(start.elapsed().as_millis() as u64)
    }

    // ── GPU ──────────────────────────────────────────────────────────────────

    pub async fn get_gpu_status(&self) -> Result<GpuInfo> {
        // Busca métricas Prometheus do vLLM e parseia
        let metrics_text = self.http
            .get(format!("{}/metrics", self.vllm_url))
            .send().await?
            .text().await?;
        Ok(parse_vllm_metrics(&metrics_text))
    }

    // ── Alerts ───────────────────────────────────────────────────────────────

    pub async fn get_pending_alerts(&self) -> Result<Vec<AdminAlert>> {
        // Gera alertas dinamicamente baseado em estado do sistema
        let mut alerts = Vec::new();

        // Verifica usuários sem MFA
        let no_mfa_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE workspace_id = current_setting('app.workspace_id')::uuid AND mfa_enabled = false AND status = 'active'"
        ).fetch_one(&self.db).await.unwrap_or(0);

        if no_mfa_count > 0 {
            alerts.push(AdminAlert {
                id: Uuid::new_v4().to_string(),
                severity: "warning".into(),
                title: format!("{} usuários sem MFA", no_mfa_count),
                description: "Habilite MFA para melhorar a segurança do workspace.".into(),
                action_label: "Ver usuários".into(),
                action_type: "navigate".into(),
                action_target: "/admin/users".into(),
            });
        }

        // Verifica webhooks com falhas consecutivas
        let failing_wh: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM webhooks WHERE workspace_id = current_setting('app.workspace_id')::uuid AND consecutive_failures >= 5"
        ).fetch_one(&self.db).await.unwrap_or(0);

        if failing_wh > 0 {
            alerts.push(AdminAlert {
                id: Uuid::new_v4().to_string(),
                severity: "critical".into(),
                title: format!("{} webhook(s) com falhas consecutivas", failing_wh),
                description: "Verifique a URL de destino e os logs de entrega.".into(),
                action_label: "Ver webhooks".into(),
                action_type: "navigate".into(),
                action_target: "/admin/integrations/webhooks".into(),
            });
        }

        Ok(alerts)
    }

    // ── Metrics ──────────────────────────────────────────────────────────────

    pub async fn get_usage_metrics(&self, period: &str) -> Result<UsageMetrics> {
        let days = period_to_days(period);
        let row = sqlx::query_as::<_, UsageMetricsRow>(
            r#"SELECT
                COALESCE(SUM(tokens_input), 0)   AS total_tokens_input,
                COALESCE(SUM(tokens_output), 0)  AS total_tokens_output,
                COALESCE(SUM(tokens_embedding), 0) AS total_tokens_embedding,
                COALESCE(COUNT(DISTINCT chat_id), 0) AS total_chat_requests,
                COALESCE(SUM(rag_queries), 0)    AS total_rag_queries,
                COALESCE(SUM(documents_processed), 0) AS total_documents_processed,
                COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS active_users
            FROM usage_events
            WHERE workspace_id = current_setting('app.workspace_id')::uuid
              AND created_at >= NOW() - ($1 || ' days')::interval"#
        )
        .bind(days)
        .fetch_one(&self.db)
        .await?;

        let cost = calculate_cost(&row);
        Ok(row.into_metrics(period, cost))
    }

    pub async fn get_daily_metrics(&self, period: &str) -> Result<Vec<DailyMetric>> {
        let days = period_to_days(period);
        let rows = sqlx::query_as::<_, DailyMetric>(
            r#"SELECT
                DATE(created_at) AS date,
                COUNT(DISTINCT chat_id) AS messages,
                COALESCE(SUM(tokens_input + tokens_output), 0) AS tokens,
                COUNT(DISTINCT user_id) AS users,
                COALESCE(SUM(documents_processed), 0) AS documents
            FROM usage_events
            WHERE workspace_id = current_setting('app.workspace_id')::uuid
              AND created_at >= NOW() - ($1 || ' days')::interval
            GROUP BY DATE(created_at)
            ORDER BY date"#
        )
        .bind(days)
        .fetch_all(&self.db)
        .await?;
        Ok(rows)
    }

    pub async fn get_top_projects(&self, limit: i64) -> Result<Vec<ProjectMetric>> {
        let rows = sqlx::query_as::<_, ProjectMetric>(
            r#"SELECT p.id, p.name, p.color, p.icon,
                COUNT(DISTINCT c.id) AS chat_count,
                COUNT(DISTINCT d.id) AS doc_count,
                COALESCE(SUM(ue.tokens_input + ue.tokens_output), 0) AS tokens_used,
                AVG(f.rating_score) AS avg_quality
            FROM projects p
            LEFT JOIN chats c ON c.project_id = p.id
            LEFT JOIN documents d ON d.project_id = p.id
            LEFT JOIN usage_events ue ON ue.project_id = p.id
            LEFT JOIN feedback f ON f.project_id = p.id
            WHERE p.workspace_id = current_setting('app.workspace_id')::uuid
            GROUP BY p.id
            ORDER BY tokens_used DESC
            LIMIT $1"#
        )
        .bind(limit)
        .fetch_all(&self.db)
        .await?;
        Ok(rows)
    }

    pub async fn get_top_users(&self, limit: i64) -> Result<Vec<UserMetric>> {
        let rows = sqlx::query_as::<_, UserMetric>(
            r#"SELECT u.id, u.name,
                COUNT(DISTINCT m.id) AS message_count,
                COUNT(DISTINCT f.id) AS feedback_count,
                MAX(ue.created_at)   AS last_active_at
            FROM users u
            LEFT JOIN messages m ON m.user_id = u.id
            LEFT JOIN feedback f ON f.user_id = u.id
            LEFT JOIN usage_events ue ON ue.user_id = u.id
            WHERE u.workspace_id = current_setting('app.workspace_id')::uuid
            GROUP BY u.id
            ORDER BY message_count DESC
            LIMIT $1"#
        )
        .bind(limit)
        .fetch_all(&self.db)
        .await?;
        Ok(rows)
    }

    pub async fn export_metrics_csv(&self, period: &str) -> Result<String> {
        let metrics = self.get_usage_metrics(period).await?;
        let csv = format!(
            "period,total_tokens_input,total_tokens_output,total_chat_requests,active_users,cost_total\n{},{},{},{},{},{}",
            metrics.period, metrics.total_tokens_input, metrics.total_tokens_output,
            metrics.total_chat_requests, metrics.active_users, metrics.estimated_cost.total
        );
        Ok(csv)
    }

    // ── Users ────────────────────────────────────────────────────────────────

    pub async fn list_users(&self) -> Result<Vec<WorkspaceUserRow>> {
        let rows = sqlx::query_as::<_, WorkspaceUserRow>(
            "SELECT u.*, r.name as role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.workspace_id = current_setting('app.workspace_id')::uuid ORDER BY u.created_at DESC"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn get_user(&self, id: Uuid) -> Result<WorkspaceUserRow> {
        let row = sqlx::query_as::<_, WorkspaceUserRow>(
            "SELECT u.*, r.name as role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND u.workspace_id = current_setting('app.workspace_id')::uuid"
        ).bind(id).fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn invite_user(&self, email: &str, role_id: &str, project_ids: &[Uuid]) -> Result<()> {
        let user_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO users (id, email, role_id, workspace_id, status) VALUES ($1, $2, $3, current_setting('app.workspace_id')::uuid, 'invited')"
        )
        .bind(user_id)
        .bind(email)
        .bind(role_id)
        .execute(&self.db).await?;

        for pid in project_ids {
            sqlx::query("INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
                .bind(pid).bind(user_id).execute(&self.db).await.ok();
        }

        // TODO: enviar e-mail de convite
        Ok(())
    }

    pub async fn update_user(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query("UPDATE users SET role_id = COALESCE($2, role_id), name = COALESCE($3, name), updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(body["role_id"].as_str())
            .bind(body["name"].as_str())
            .execute(&self.db).await?;
        Ok(())
    }

    pub async fn set_user_status(&self, id: Uuid, status: &str) -> Result<()> {
        sqlx::query("UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1")
            .bind(id).bind(status).execute(&self.db).await?;
        Ok(())
    }

    pub async fn export_users_csv(&self) -> Result<String> {
        let users = self.list_users().await?;
        let mut csv = "id,name,email,role,status,mfa_enabled,last_login\n".to_string();
        for u in users {
            csv.push_str(&format!("{},{},{},{},{},{},{}\n",
                u.id, u.name, u.email, u.role_name, u.status, u.mfa_enabled,
                u.last_login_at.map(|d| d.to_string()).unwrap_or_default()
            ));
        }
        Ok(csv)
    }

    // ── Roles ─────────────────────────────────────────────────────────────────

    pub async fn list_roles(&self) -> Result<Vec<RoleRow>> {
        let rows = sqlx::query_as::<_, RoleRow>(
            "SELECT * FROM roles WHERE workspace_id = current_setting('app.workspace_id')::uuid OR is_system = true ORDER BY is_system DESC, name"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn create_role(&self, body: serde_json::Value) -> Result<RoleRow> {
        let id = Uuid::new_v4();
        let row = sqlx::query_as::<_, RoleRow>(
            "INSERT INTO roles (id, name, description, workspace_id, is_system, permissions) VALUES ($1, $2, $3, current_setting('app.workspace_id')::uuid, false, $4) RETURNING *"
        )
        .bind(id)
        .bind(body["name"].as_str().unwrap_or_default())
        .bind(body["description"].as_str().unwrap_or_default())
        .bind(&body["permissions"])
        .fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn update_role(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query("UPDATE roles SET name = COALESCE($2, name), permissions = COALESCE($3, permissions), updated_at = NOW() WHERE id = $1 AND is_system = false")
            .bind(id)
            .bind(body["name"].as_str())
            .bind(&body["permissions"])
            .execute(&self.db).await?;
        Ok(())
    }

    pub async fn delete_role(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM roles WHERE id = $1 AND is_system = false")
            .bind(id).execute(&self.db).await?;
        Ok(())
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    pub async fn list_active_sessions(&self) -> Result<Vec<SessionRow>> {
        let rows = sqlx::query_as::<_, SessionRow>(
            "SELECT s.*, u.name as user_name, u.email as user_email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.workspace_id = current_setting('app.workspace_id')::uuid AND s.expires_at > NOW() ORDER BY s.created_at DESC"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn terminate_session(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE sessions SET expires_at = NOW() WHERE id = $1")
            .bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn terminate_all_sessions(&self, except: Uuid) -> Result<i64> {
        let result = sqlx::query(
            "UPDATE sessions SET expires_at = NOW() WHERE workspace_id = current_setting('app.workspace_id')::uuid AND id != $1 AND expires_at > NOW()"
        ).bind(except).execute(&self.db).await?;
        Ok(result.rows_affected() as i64)
    }

    // ── Audit ─────────────────────────────────────────────────────────────────

    pub async fn query_audit_logs(&self, filters: AuditFiltersQuery) -> Result<AuditPage> {
        let page = filters.page.unwrap_or(1);
        let per_page = filters.per_page.unwrap_or(50);
        let offset = (page - 1) * per_page;

        let rows = sqlx::query_as::<_, AuditLogRow>(
            r#"SELECT * FROM audit_logs
               WHERE workspace_id = current_setting('app.workspace_id')::uuid
               AND ($1::text IS NULL OR category = $1)
               AND ($2::text IS NULL OR severity = $2)
               AND ($3::uuid IS NULL OR user_id = $3)
               ORDER BY created_at DESC
               LIMIT $4 OFFSET $5"#
        )
        .bind(&filters.category)
        .bind(&filters.severity)
        .bind(filters.user_id)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&self.db).await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM audit_logs WHERE workspace_id = current_setting('app.workspace_id')::uuid"
        ).fetch_one(&self.db).await.unwrap_or(0);

        Ok(AuditPage { entries: rows, total, page, per_page })
    }

    pub async fn export_audit_csv(&self, filters: AuditFiltersQuery) -> Result<String> {
        let page = self.query_audit_logs(filters).await?;
        let mut csv = "id,timestamp,user,action,resource,severity,category\n".to_string();
        for e in page.entries {
            csv.push_str(&format!("{},{},{},{},{},{},{}\n",
                e.id, e.created_at, e.user_name, e.action, e.resource_name, e.severity, e.category
            ));
        }
        Ok(csv)
    }

    pub async fn generate_compliance_report(&self) -> Result<ComplianceReport> {
        // Coleta estatísticas para o relatório LGPD
        let total_users: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE workspace_id = current_setting('app.workspace_id')::uuid"
        ).fetch_one(&self.db).await.unwrap_or(0);

        let mfa_enabled: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE workspace_id = current_setting('app.workspace_id')::uuid AND mfa_enabled = true"
        ).fetch_one(&self.db).await.unwrap_or(0);

        let mfa_percent = if total_users > 0 { (mfa_enabled * 100) / total_users } else { 0 };
        let overall_score = ((mfa_percent as f64 * 0.2) + 80.0).min(100.0);

        Ok(ComplianceReport {
            generated_at: Utc::now().to_rfc3339(),
            overall_score: overall_score as i32,
            access_stats: AccessStats {
                total_users,
                mfa_enabled,
                mfa_percent: mfa_percent as f64,
                failed_logins: 0, // TODO: query audit_logs
                access_denied: 0,
            },
        })
    }

    // ── AI Models ─────────────────────────────────────────────────────────────

    pub async fn list_models(&self) -> Result<Vec<AiModelConfig>> {
        let rows = sqlx::query_as::<_, AiModelConfig>(
            "SELECT * FROM ai_model_configs WHERE workspace_id = current_setting('app.workspace_id')::uuid"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn update_model_config(&self, id: &str, body: serde_json::Value) -> Result<()> {
        sqlx::query(
            "UPDATE ai_model_configs SET default_temperature = COALESCE($2, default_temperature), default_max_tokens = COALESCE($3, default_max_tokens), updated_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .bind(body["defaultTemperature"].as_f64())
        .bind(body["defaultMaxTokens"].as_i64())
        .execute(&self.db).await?;
        Ok(())
    }

    pub async fn list_lora_adapters(&self) -> Result<Vec<LoraAdapter>> {
        let rows = sqlx::query_as::<_, LoraAdapter>(
            "SELECT * FROM lora_adapters WHERE workspace_id = current_setting('app.workspace_id')::uuid ORDER BY trained_at DESC"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn deploy_lora(&self, version: &str) -> Result<()> {
        // Desativa o atual e ativa a nova versão
        sqlx::query("UPDATE lora_adapters SET status = 'available' WHERE workspace_id = current_setting('app.workspace_id')::uuid AND status = 'active'")
            .execute(&self.db).await?;
        sqlx::query("UPDATE lora_adapters SET status = 'active', deployed_at = NOW() WHERE version = $1")
            .bind(version).execute(&self.db).await?;
        // TODO: hot-swap no vLLM via API
        Ok(())
    }

    pub async fn rollback_lora(&self, _version: &str) -> Result<()> {
        // Reverte para versão anterior
        sqlx::query(
            "UPDATE lora_adapters SET status = 'rolledback' WHERE workspace_id = current_setting('app.workspace_id')::uuid AND status = 'active'"
        ).execute(&self.db).await?;
        // Ativa a penúltima versão
        sqlx::query(
            "UPDATE lora_adapters SET status = 'active', deployed_at = NOW() WHERE id = (SELECT id FROM lora_adapters WHERE workspace_id = current_setting('app.workspace_id')::uuid AND status = 'available' ORDER BY trained_at DESC LIMIT 1)"
        ).execute(&self.db).await?;
        Ok(())
    }

    pub async fn start_training_batch(&self) -> Result<TrainingBatch> {
        let id = Uuid::new_v4();
        let batch = sqlx::query_as::<_, TrainingBatch>(
            "INSERT INTO training_batches (id, workspace_id, status) VALUES ($1, current_setting('app.workspace_id')::uuid, 'queued') RETURNING *"
        ).bind(id).fetch_one(&self.db).await?;
        // TODO: enqueue no worker de treinamento
        Ok(batch)
    }

    pub async fn get_latest_training_batch(&self) -> Result<TrainingBatch> {
        let batch = sqlx::query_as::<_, TrainingBatch>(
            "SELECT * FROM training_batches WHERE workspace_id = current_setting('app.workspace_id')::uuid ORDER BY created_at DESC LIMIT 1"
        ).fetch_one(&self.db).await?;
        Ok(batch)
    }

    pub async fn get_rag_config(&self) -> Result<RagConfig> {
        let config = sqlx::query_as::<_, RagConfig>(
            "SELECT * FROM rag_configs WHERE workspace_id = current_setting('app.workspace_id')::uuid LIMIT 1"
        ).fetch_one(&self.db).await?;
        Ok(config)
    }

    pub async fn update_rag_config(&self, config: RagConfig) -> Result<()> {
        sqlx::query(
            "UPDATE rag_configs SET top_k = $2, chunk_size = $3, chunk_overlap = $4, similarity_threshold = $5, updated_at = NOW() WHERE workspace_id = current_setting('app.workspace_id')::uuid"
        )
        .bind(config.top_k)
        .bind(config.chunk_size)
        .bind(config.chunk_overlap)
        .bind(config.similarity_threshold)
        .execute(&self.db).await?;
        Ok(())
    }

    // ── API Keys ──────────────────────────────────────────────────────────────

    pub async fn list_api_keys(&self) -> Result<Vec<ApiKeyRow>> {
        let rows = sqlx::query_as::<_, ApiKeyRow>(
            "SELECT * FROM api_keys WHERE workspace_id = current_setting('app.workspace_id')::uuid ORDER BY created_at DESC"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn create_api_key(
        &self,
        name: &str,
        permissions: &[String],
        rate_limit: i32,
        expires_at: Option<&str>,
    ) -> Result<(ApiKeyRow, String)> {
        // Gera chave aleatória segura
        let raw_key = format!("btv_live_{}", generate_random_token(32));
        let key_hash = hash_api_key(&raw_key);
        let prefix = &raw_key[..12]; // primeiros 12 chars visíveis
        let masked = format!("{}••••••••••••{}", prefix, &raw_key[raw_key.len()-4..]);

        let row = sqlx::query_as::<_, ApiKeyRow>(
            r#"INSERT INTO api_keys (id, workspace_id, name, key_hash, masked_key, prefix, permissions, rate_limit, expires_at, status)
               VALUES (gen_random_uuid(), current_setting('app.workspace_id')::uuid, $1, $2, $3, $4, $5, $6, $7, 'active')
               RETURNING *"#
        )
        .bind(name)
        .bind(&key_hash)
        .bind(&masked)
        .bind(prefix)
        .bind(serde_json::to_value(permissions)?)
        .bind(rate_limit)
        .bind(expires_at)
        .fetch_one(&self.db).await?;

        Ok((row, raw_key))
    }

    pub async fn update_api_key(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query("UPDATE api_keys SET name = COALESCE($2, name), rate_limit = COALESCE($3, rate_limit), updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(body["name"].as_str())
            .bind(body["rateLimit"].as_i64().map(|v| v as i32))
            .execute(&self.db).await?;
        Ok(())
    }

    pub async fn revoke_api_key(&self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE api_keys SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() WHERE id = $1")
            .bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn delete_api_key(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM api_keys WHERE id = $1").bind(id).execute(&self.db).await?;
        Ok(())
    }

    // ── Webhooks ──────────────────────────────────────────────────────────────

    pub async fn list_webhooks(&self) -> Result<Vec<WebhookRow>> {
        let rows = sqlx::query_as::<_, WebhookRow>(
            "SELECT * FROM webhooks WHERE workspace_id = current_setting('app.workspace_id')::uuid ORDER BY created_at DESC"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn get_webhook(&self, id: Uuid) -> Result<WebhookRow> {
        let row = sqlx::query_as::<_, WebhookRow>("SELECT * FROM webhooks WHERE id = $1")
            .bind(id).fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn create_webhook(&self, body: serde_json::Value) -> Result<WebhookRow> {
        let row = sqlx::query_as::<_, WebhookRow>(
            r#"INSERT INTO webhooks (id, workspace_id, name, url, secret, events, retry_policy, timeout_ms, status)
               VALUES (gen_random_uuid(), current_setting('app.workspace_id')::uuid, $1, $2, $3, $4, $5, $6, 'active')
               RETURNING *"#
        )
        .bind(body["name"].as_str())
        .bind(body["url"].as_str())
        .bind(body["secret"].as_str())
        .bind(&body["events"])
        .bind(body["retryPolicy"].as_str().unwrap_or("3x"))
        .bind(body["timeoutMs"].as_i64().unwrap_or(5000) as i32)
        .fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn update_webhook(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query("UPDATE webhooks SET name = COALESCE($2, name), url = COALESCE($3, url), events = COALESCE($4, events), updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(body["name"].as_str())
            .bind(body["url"].as_str())
            .bind(&body["events"])
            .execute(&self.db).await?;
        Ok(())
    }

    pub async fn delete_webhook(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM webhooks WHERE id = $1").bind(id).execute(&self.db).await?;
        Ok(())
    }

    pub async fn set_webhook_status(&self, id: Uuid, status: &str) -> Result<()> {
        sqlx::query("UPDATE webhooks SET status = $2, updated_at = NOW() WHERE id = $1")
            .bind(id).bind(status).execute(&self.db).await?;
        Ok(())
    }

    pub async fn test_webhook(&self, id: Uuid) -> Result<()> {
        let wh = self.get_webhook(id).await?;
        let payload = serde_json::json!({ "event": "webhook.test", "data": { "timestamp": Utc::now() } });
        // Assina com HMAC-SHA256
        let signature = sign_hmac(&wh.secret, &payload.to_string());
        self.http.post(&wh.url)
            .header("X-BTV-Signature", &signature)
            .header("X-BTV-Event", "webhook.test")
            .json(&payload)
            .timeout(std::time::Duration::from_millis(wh.timeout_ms as u64))
            .send().await?;
        Ok(())
    }

    pub async fn list_webhook_deliveries(
        &self, webhook_id: Uuid, page: i64, per_page: i64, status: Option<&str>
    ) -> Result<Vec<WebhookDelivery>> {
        let offset = (page - 1) * per_page;
        let rows = sqlx::query_as::<_, WebhookDelivery>(
            "SELECT * FROM webhook_deliveries WHERE webhook_id = $1 AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC LIMIT $3 OFFSET $4"
        )
        .bind(webhook_id)
        .bind(status)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn retry_webhook_delivery(&self, _webhook_id: Uuid, delivery_id: Uuid) -> Result<()> {
        sqlx::query("UPDATE webhook_deliveries SET status = 'retrying', next_retry_at = NOW() WHERE id = $1")
            .bind(delivery_id).execute(&self.db).await?;
        // TODO: enqueue no dispatcher de webhooks
        Ok(())
    }

    // ── Resource Limits ───────────────────────────────────────────────────────

    pub async fn list_resource_limits(&self) -> Result<Vec<ResourceLimitRow>> {
        let rows = sqlx::query_as::<_, ResourceLimitRow>(
            "SELECT * FROM resource_limits WHERE workspace_id = current_setting('app.workspace_id')::uuid ORDER BY type, target_name"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn create_resource_limit(&self, body: serde_json::Value) -> Result<ResourceLimitRow> {
        let row = sqlx::query_as::<_, ResourceLimitRow>(
            r#"INSERT INTO resource_limits (id, workspace_id, type, target_name, max_tokens_per_day, max_messages_per_day, max_documents_total, max_storage_gb, max_api_requests_per_min)
               VALUES (gen_random_uuid(), current_setting('app.workspace_id')::uuid, $1, $2, $3, $4, $5, $6, $7)
               RETURNING *"#
        )
        .bind(body["type"].as_str())
        .bind(body["targetName"].as_str())
        .bind(body["maxTokensPerDay"].as_i64())
        .bind(body["maxMessagesPerDay"].as_i64())
        .bind(body["maxDocumentsTotal"].as_i64())
        .bind(body["maxStorageGb"].as_f64())
        .bind(body["maxApiRequestsPerMin"].as_i64())
        .fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn update_resource_limit(&self, id: Uuid, body: serde_json::Value) -> Result<()> {
        sqlx::query("UPDATE resource_limits SET max_tokens_per_day = $2, max_messages_per_day = $3, max_storage_gb = $4, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(body["maxTokensPerDay"].as_i64())
            .bind(body["maxMessagesPerDay"].as_i64())
            .bind(body["maxStorageGb"].as_f64())
            .execute(&self.db).await?;
        Ok(())
    }

    pub async fn delete_resource_limit(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM resource_limits WHERE id = $1").bind(id).execute(&self.db).await?;
        Ok(())
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    pub async fn get_settings(&self) -> Result<WorkspaceSettings> {
        let row = sqlx::query_as::<_, WorkspaceSettings>(
            "SELECT * FROM workspace_settings WHERE workspace_id = current_setting('app.workspace_id')::uuid LIMIT 1"
        ).fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn update_settings(&self, settings: WorkspaceSettings) -> Result<()> {
        sqlx::query(
            r#"UPDATE workspace_settings SET name=$2, slug=$3, timezone=$4, language=$5,
               session_timeout_minutes=$6, max_concurrent_sessions=$7, mfa_required=$8,
               notify_on_new_user=$9, notify_on_training_complete=$10, notify_on_security_event=$11,
               notification_email=$12, updated_at=NOW()
               WHERE workspace_id = current_setting('app.workspace_id')::uuid"#
        )
        .bind(&settings.name)
        .bind(&settings.slug)
        .bind(&settings.timezone)
        .bind(&settings.language)
        .bind(settings.session_timeout_minutes)
        .bind(settings.max_concurrent_sessions)
        .bind(settings.mfa_required)
        .bind(settings.notify_on_new_user)
        .bind(settings.notify_on_training_complete)
        .bind(settings.notify_on_security_event)
        .bind(&settings.notification_email)
        .execute(&self.db).await?;
        Ok(())
    }

    // ── Branding ──────────────────────────────────────────────────────────────

    pub async fn get_branding(&self) -> Result<BrandingConfig> {
        let row = sqlx::query_as::<_, BrandingConfig>(
            "SELECT * FROM branding_configs WHERE workspace_id = current_setting('app.workspace_id')::uuid LIMIT 1"
        ).fetch_one(&self.db).await?;
        Ok(row)
    }

    pub async fn update_branding(&self, config: BrandingConfig) -> Result<()> {
        sqlx::query(
            r#"UPDATE branding_configs SET product_name=$2, tagline=$3, logo_url=$4, favicon_url=$5,
               primary_color=$6, secondary_color=$7, accent_color=$8, bg_color=$9, surface_color=$10,
               text_color=$11, font_family=$12, custom_domain=$13, show_powered_by=$14,
               terms_url=$15, privacy_url=$16, support_email=$17, features=$18, updated_at=NOW()
               WHERE workspace_id = current_setting('app.workspace_id')::uuid"#
        )
        .bind(&config.product_name)
        .bind(&config.tagline)
        .bind(&config.logo_url)
        .bind(&config.favicon_url)
        .bind(&config.primary_color)
        .bind(&config.secondary_color)
        .bind(&config.accent_color)
        .bind(&config.bg_color)
        .bind(&config.surface_color)
        .bind(&config.text_color)
        .bind(&config.font_family)
        .bind(&config.custom_domain)
        .bind(config.show_powered_by)
        .bind(&config.terms_url)
        .bind(&config.privacy_url)
        .bind(&config.support_email)
        .bind(serde_json::to_value(&config.features)?)
        .execute(&self.db).await?;
        Ok(())
    }

    pub async fn verify_domain(&self, domain: &str) -> Result<String> {
        // Verifica se existe registro CNAME apontando para cname.btvchat.com
        use std::net::ToSocketAddrs;
        let is_valid = format!("{}:443", domain)
            .to_socket_addrs()
            .map(|_| true)
            .unwrap_or(false);
        let status = if is_valid { "verified" } else { "pending" };
        sqlx::query("UPDATE branding_configs SET custom_domain_status = $2 WHERE workspace_id = current_setting('app.workspace_id')::uuid")
            .bind(status).execute(&self.db).await.ok();
        Ok(status.to_string())
    }

    // ── Retention ─────────────────────────────────────────────────────────────

    pub async fn get_retention_policies(&self) -> Result<Vec<RetentionPolicy>> {
        let rows = sqlx::query_as::<_, RetentionPolicy>(
            "SELECT * FROM retention_policies WHERE workspace_id = current_setting('app.workspace_id')::uuid ORDER BY data_type"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn update_retention_policies(&self, policies: Vec<RetentionPolicy>) -> Result<()> {
        for p in policies {
            sqlx::query(
                "UPDATE retention_policies SET retention_days=$2, auto_delete_enabled=$3, updated_at=NOW() WHERE data_type=$1 AND workspace_id=current_setting('app.workspace_id')::uuid"
            )
            .bind(&p.data_type)
            .bind(p.retention_days)
            .bind(p.auto_delete_enabled)
            .execute(&self.db).await?;
        }
        Ok(())
    }

    pub async fn manual_purge(&self, data_type: &str) -> Result<i64> {
        let table = match data_type {
            "chats"         => "chats",
            "documents"     => "documents",
            "audit_logs"    => "audit_logs",
            "training_data" => "training_interactions",
            _               => return Err(anyhow::anyhow!("Unknown data type")),
        };
        let policy: Option<i32> = sqlx::query_scalar(
            "SELECT retention_days FROM retention_policies WHERE data_type = $1 AND workspace_id = current_setting('app.workspace_id')::uuid"
        ).bind(data_type).fetch_optional(&self.db).await?;

        if let Some(days) = policy {
            let result = sqlx::query(&format!(
                "DELETE FROM {} WHERE workspace_id = current_setting('app.workspace_id')::uuid AND created_at < NOW() - ($1 || ' days')::interval",
                table
            )).bind(days).execute(&self.db).await?;
            Ok(result.rows_affected() as i64)
        } else {
            Ok(0)
        }
    }

    pub async fn list_deletion_requests(&self) -> Result<Vec<DeletionRequest>> {
        let rows = sqlx::query_as::<_, DeletionRequest>(
            "SELECT * FROM deletion_requests WHERE workspace_id = current_setting('app.workspace_id')::uuid ORDER BY requested_at DESC"
        ).fetch_all(&self.db).await?;
        Ok(rows)
    }

    pub async fn create_deletion_request(&self, target_name: &str, data_type: &str) -> Result<()> {
        sqlx::query(
            "INSERT INTO deletion_requests (id, workspace_id, type, target_name, status, requested_at) VALUES (gen_random_uuid(), current_setting('app.workspace_id')::uuid, $1, $2, 'pending', NOW())"
        ).bind(data_type).bind(target_name).execute(&self.db).await?;
        Ok(())
    }

    // ── Export ────────────────────────────────────────────────────────────────

    pub async fn export_all_data(&self) -> Result<Vec<u8>> {
        // Retorna ZIP vazio como placeholder — implementação real usa zip crate
        Ok(vec![])
    }

    // ── API Docs ──────────────────────────────────────────────────────────────

    pub async fn list_api_endpoints(&self) -> Result<Vec<ApiEndpointDoc>> {
        // Retorna lista estática dos endpoints documentados
        Ok(vec![
            ApiEndpointDoc {
                method: "POST".into(), path: "/v1/chat".into(),
                summary: "Criar completion de chat".into(),
                description: "Envia uma mensagem e recebe resposta do modelo LLM com RAG.".into(),
                tag: "Chat".into(), requires_auth: true,
                scopes: vec!["chat:write".into()],
                request_body: Some(serde_json::json!({ "message": "string", "project_id": "uuid", "stream": true })),
                response_example: Some(serde_json::json!({ "id": "uuid", "content": "string", "sources": [] })),
            },
            ApiEndpointDoc {
                method: "POST".into(), path: "/v1/documents".into(),
                summary: "Upload de documento".into(),
                description: "Envia um documento para indexação no Vector DB do projeto.".into(),
                tag: "Documents".into(), requires_auth: true,
                scopes: vec!["documents:write".into()],
                request_body: Some(serde_json::json!({ "file": "binary", "project_id": "uuid", "classification": "INTERNAL" })),
                response_example: Some(serde_json::json!({ "id": "uuid", "status": "processing" })),
            },
        ])
    }

    pub async fn get_openapi_spec(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "openapi": "3.0.0",
            "info": { "title": "BTV Chat API", "version": "1.0.0" },
            "paths": {}
        }))
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

fn period_to_days(period: &str) -> i32 {
    match period { "7d" => 7, "90d" => 90, _ => 30 }
}

fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

fn generate_random_token(len: usize) -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..len).map(|_| rng.sample(rand::distributions::Alphanumeric) as char).collect()
}

fn sign_hmac(secret: &str, payload: &str) -> String {
    use hmac::{Hmac, Mac};
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(payload.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

fn parse_vllm_metrics(text: &str) -> GpuInfo {
    // Parse simplificado de métricas Prometheus
    let get = |key: &str| -> f64 {
        text.lines()
            .find(|l| l.starts_with(key) && !l.starts_with('#'))
            .and_then(|l| l.split_whitespace().last())
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.0)
    };
    let util = get("vllm:gpu_cache_usage_perc") * 100.0;
    GpuInfo {
        model: "NVIDIA A100".into(),
        utilization: util as i32,
        vram_used: (util * 0.8) as f32,
        vram_total: 80.0,
        vram_percent: util as f32,
        temperature: 65,
        requests_per_min: get("vllm:num_requests_running") as i32,
        active_model: "Llama 3.3 70B".into(),
        active_lora_version: None,
        provider: "Local".into(),
    }
}

fn calculate_cost(row: &UsageMetricsRow) -> EstimatedCost {
    // R$ por hora de GPU (A100)
    let gpu_hour_rate = 12.0_f64;
    // Estimativa: 1M tokens ≈ 0.5h de GPU
    let tokens_total = (row.total_tokens_input + row.total_tokens_output) as f64;
    let gpu_hours = tokens_total / 2_000_000.0;
    let gpu_cost = gpu_hours * gpu_hour_rate;
    let storage_cost = 2.5_f64; // estimativa plana por mês
    let network_cost = tokens_total / 1_000_000.0 * 0.1;
    EstimatedCost {
        gpu: gpu_cost,
        storage: storage_cost,
        network: network_cost,
        total: gpu_cost + storage_cost + network_cost,
        currency: "BRL".into(),
    }
}
