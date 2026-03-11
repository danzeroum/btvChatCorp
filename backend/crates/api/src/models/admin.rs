use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

// ── System Health ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemHealth {
    pub status: String,
    pub api: bool,
    pub database: bool,
    pub vector_db: bool,
    pub gpu: bool,
    pub embedding: bool,
    pub uptime_percent: f64,
    pub avg_latency_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GpuInfo {
    pub model: String,
    pub utilization: i32,
    pub vram_used: f32,
    pub vram_total: f32,
    pub vram_percent: f32,
    pub temperature: i32,
    pub requests_per_min: i32,
    pub active_model: String,
    pub active_lora_version: Option<String>,
    pub provider: String,
}

// ── Alerts ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct AdminAlert {
    pub id: String,
    pub severity: String,
    pub title: String,
    pub description: String,
    pub action_label: String,
    pub action_type: String,
    pub action_target: String,
}

// ── Metrics ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UsageMetricsRow {
    pub total_tokens_input: i64,
    pub total_tokens_output: i64,
    pub total_tokens_embedding: i64,
    pub total_chat_requests: i64,
    pub total_rag_queries: i64,
    pub total_documents_processed: i64,
    pub active_users: i64,
}

impl UsageMetricsRow {
    pub fn into_metrics(self, period: &str, cost: EstimatedCost) -> UsageMetrics {
        UsageMetrics {
            period: period.to_string(),
            total_tokens_input: self.total_tokens_input,
            total_tokens_output: self.total_tokens_output,
            total_tokens_embedding: self.total_tokens_embedding,
            total_chat_requests: self.total_chat_requests,
            total_rag_queries: self.total_rag_queries,
            total_documents_processed: self.total_documents_processed,
            total_training_runs: 0,
            gpu_hours_inference: 0.0,
            gpu_hours_training: 0.0,
            gpu_hours_embedding: 0.0,
            storage_documents_gb: 0.0,
            storage_vector_db_gb: 0.0,
            storage_models_gb: 0.0,
            estimated_cost: cost,
            by_project: vec![],
            by_user: vec![],
            active_users: self.active_users,
            chats_trend_percent: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageMetrics {
    pub period: String,
    pub total_tokens_input: i64,
    pub total_tokens_output: i64,
    pub total_tokens_embedding: i64,
    pub total_chat_requests: i64,
    pub total_rag_queries: i64,
    pub total_documents_processed: i64,
    pub total_training_runs: i64,
    pub gpu_hours_inference: f64,
    pub gpu_hours_training: f64,
    pub gpu_hours_embedding: f64,
    pub storage_documents_gb: f64,
    pub storage_vector_db_gb: f64,
    pub storage_models_gb: f64,
    pub estimated_cost: EstimatedCost,
    pub by_project: Vec<ProjectUsage>,
    pub by_user: Vec<UserUsage>,
    pub active_users: i64,
    pub chats_trend_percent: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EstimatedCost {
    pub gpu: f64,
    pub storage: f64,
    pub network: f64,
    pub total: f64,
    pub currency: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectUsage {
    pub project_id: String,
    pub project_name: String,
    pub tokens_used: i64,
    pub chat_count: i64,
    pub percent_of_total: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserUsage {
    pub user_id: String,
    pub user_name: String,
    pub tokens_used: i64,
    pub chat_count: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DailyMetric {
    pub date: DateTime<Utc>,
    pub messages: i64,
    pub tokens: i64,
    pub users: i64,
    pub documents: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ProjectMetric {
    pub id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub chat_count: i64,
    pub doc_count: i64,
    pub tokens_used: i64,
    pub avg_quality: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserMetric {
    pub id: Uuid,
    pub name: String,
    pub message_count: i64,
    pub feedback_count: i64,
    pub last_active_at: Option<DateTime<Utc>>,
}

// ── Users ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct WorkspaceUserRow {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role_name: String,
    pub status: String,
    pub mfa_enabled: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub last_login_ip: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RoleRow {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub is_system: bool,
    pub permissions: serde_json::Value,
    pub user_count: Option<i64>,
}

// ── Sessions ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct SessionRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub user_email: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

// ── Audit ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AuditLogRow {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Option<Uuid>,
    pub user_name: String,
    pub user_ip: Option<String>,
    pub action: String,
    pub resource_name: String,
    pub severity: String,
    pub category: String,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuditPage {
    pub entries: Vec<AuditLogRow>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct AuditFiltersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub category: Option<String>,
    pub severity: Option<String>,
    pub user_id: Option<Uuid>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub search: Option<String>,
}

impl From<super::super::routes::admin::AuditQuery> for AuditFiltersQuery {
    fn from(q: super::super::routes::admin::AuditQuery) -> Self {
        Self {
            page: q.page, per_page: q.per_page, category: q.category,
            severity: q.severity, user_id: q.user_id,
            date_from: q.date_from, date_to: q.date_to, search: q.search,
        }
    }
}

// ── Compliance ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ComplianceReport {
    pub generated_at: String,
    pub overall_score: i32,
    pub access_stats: AccessStats,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccessStats {
    pub total_users: i64,
    pub mfa_enabled: i64,
    pub mfa_percent: f64,
    pub failed_logins: i64,
    pub access_denied: i64,
}

// ── AI Models ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AiModelConfig {
    pub id: String,
    pub display_name: String,
    pub base_model: String,
    pub inference_url: String,
    pub status: String,
    pub default_temperature: f64,
    pub default_max_tokens: i32,
    pub context_window_size: i32,
    pub avg_latency_ms: i32,
    pub requests_per_minute: i32,
    pub gpu_utilization: i32,
    pub active_lora_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct LoraAdapter {
    pub version: String,
    pub path: String,
    pub trained_at: DateTime<Utc>,
    pub training_examples: i32,
    pub training_loss: f64,
    pub eval_accuracy: f64,
    pub status: String,
    pub deployed_at: Option<DateTime<Utc>>,
    pub improvement_vs_previous: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TrainingBatch {
    pub id: Uuid,
    pub status: String,
    pub total_examples: Option<i32>,
    pub positive_examples: Option<i32>,
    pub corrected_examples: Option<i32>,
    pub progress: Option<i32>,
    pub current_epoch: Option<i32>,
    pub total_epochs: Option<i32>,
    pub training_loss: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub deployed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RagConfig {
    pub top_k: i32,
    pub chunk_size: i32,
    pub chunk_overlap: i32,
    pub similarity_threshold: f64,
}

// ── API Keys ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ApiKeyRow {
    pub id: Uuid,
    pub name: String,
    pub prefix: String,
    pub masked_key: String,
    pub permissions: serde_json::Value,
    pub rate_limit: i32,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub usage_today: Option<i64>,
    pub usage_total: Option<i64>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
}

// ── Webhooks ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct WebhookRow {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub secret: String,
    pub events: serde_json::Value,
    pub status: String,
    pub retry_policy: String,
    pub timeout_ms: i32,
    pub success_rate: Option<f64>,
    pub total_deliveries: Option<i64>,
    pub last_delivery_at: Option<DateTime<Utc>>,
    pub last_delivery_status: Option<i32>,
    pub consecutive_failures: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct WebhookDelivery {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event: String,
    pub url: String,
    pub request_body: Option<String>,
    pub request_headers: Option<serde_json::Value>,
    pub response_status: Option<i32>,
    pub response_body: Option<String>,
    pub duration_ms: Option<i32>,
    pub status: String,
    pub attempt: i32,
    pub max_attempts: i32,
    pub created_at: DateTime<Utc>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub next_retry_at: Option<DateTime<Utc>>,
}

// ── Resource Limits ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ResourceLimitRow {
    pub id: Uuid,
    pub r#type: String,
    pub target_name: String,
    pub max_tokens_per_day: Option<i64>,
    pub max_messages_per_day: Option<i64>,
    pub max_documents_total: Option<i64>,
    pub max_storage_gb: Option<f64>,
    pub max_api_requests_per_min: Option<i64>,
    pub current_tokens_today: i64,
    pub current_messages_today: i64,
    pub current_documents_total: i64,
    pub current_storage_gb: f64,
    pub updated_at: DateTime<Utc>,
}

// ── Settings ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct WorkspaceSettings {
    pub name: String,
    pub slug: String,
    pub timezone: String,
    pub language: String,
    pub session_timeout_minutes: i32,
    pub max_concurrent_sessions: i32,
    pub mfa_required: bool,
    pub notify_on_new_user: bool,
    pub notify_on_training_complete: bool,
    pub notify_on_security_event: bool,
    pub notification_email: String,
    pub allow_user_self_registration: bool,
}

// ── Branding ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct BrandingConfig {
    pub product_name: String,
    pub tagline: String,
    pub logo_url: Option<String>,
    pub favicon_url: Option<String>,
    pub primary_color: String,
    pub secondary_color: String,
    pub accent_color: String,
    pub bg_color: String,
    pub surface_color: String,
    pub text_color: String,
    pub font_family: String,
    pub custom_font_url: Option<String>,
    pub custom_domain: Option<String>,
    pub custom_domain_status: Option<String>,
    pub show_powered_by: bool,
    pub terms_url: Option<String>,
    pub privacy_url: Option<String>,
    pub support_email: Option<String>,
    pub features: serde_json::Value,
}

// ── Retention ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RetentionPolicy {
    pub data_type: String,
    pub retention_days: Option<i32>,
    pub auto_delete_enabled: bool,
    pub last_purge_at: Option<DateTime<Utc>>,
    pub next_purge_at: Option<DateTime<Utc>>,
    pub current_size_gb: f64,
    pub item_count: i64,
    pub purgeable: bool,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DeletionRequest {
    pub id: Uuid,
    pub r#type: String,
    pub requested_by: String,
    pub target_name: String,
    pub status: String,
    pub requested_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub items_deleted: Option<i64>,
}

// ── API Docs ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiEndpointDoc {
    pub method: String,
    pub path: String,
    pub summary: String,
    pub description: String,
    pub tag: String,
    pub requires_auth: bool,
    pub scopes: Vec<String>,
    pub request_body: Option<serde_json::Value>,
    pub response_example: Option<serde_json::Value>,
}
