use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    response::Json,
    routing::{delete, get, post, put, patch},
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    middleware::require_admin_role,
    state::AppState,
    models::admin::*,
};

// ─── Router ────────────────────────────────────────────────────────────────────

pub fn admin_routes() -> Router<AppState> {
    Router::new()
        // Dashboard
        .route("/admin/health",                   get(system_health))
        .route("/admin/gpu-status",              get(gpu_status))
        .route("/admin/alerts",                  get(pending_alerts))
        // Metrics
        .route("/admin/metrics",                 get(usage_metrics))
        .route("/admin/metrics/daily",           get(daily_metrics))
        .route("/admin/metrics/top-projects",    get(top_projects))
        .route("/admin/metrics/top-users",       get(top_users))
        .route("/admin/metrics/export",          get(export_metrics))
        // Users
        .route("/admin/users",                   get(list_users).post(invite_user))
        .route("/admin/users/:id",               get(get_user).put(update_user))
        .route("/admin/users/:id/suspend",       post(suspend_user))
        .route("/admin/users/:id/activate",      post(activate_user))
        .route("/admin/users/export",            get(export_users))
        // Roles & Permissions
        .route("/admin/roles",                   get(list_roles).post(create_role))
        .route("/admin/roles/:id",               put(update_role).delete(delete_role))
        // Sessions
        .route("/admin/sessions",                get(list_sessions))
        .route("/admin/sessions/:id",            delete(terminate_session))
        .route("/admin/sessions/terminate-all",  post(terminate_all_sessions))
        // Audit
        .route("/admin/audit",                   get(query_audit_logs))
        .route("/admin/audit/export",            get(export_audit_csv))
        .route("/admin/compliance-report",       get(compliance_report))
        // AI Config
        .route("/admin/ai/models",               get(list_models))
        .route("/admin/ai/models/:id",           put(update_model_config))
        .route("/admin/ai/lora",                 get(list_lora_adapters))
        .route("/admin/ai/lora/:version/deploy", post(deploy_lora))
        .route("/admin/ai/lora/:version/rollback",post(rollback_lora))
        .route("/admin/ai/training/start",       post(start_training))
        .route("/admin/ai/training/status",      get(training_status))
        .route("/admin/ai/rag-config",           get(get_rag_config).put(update_rag_config))
        // API Keys
        .route("/admin/api-keys",                get(list_api_keys).post(create_api_key))
        .route("/admin/api-keys/:id",            put(update_api_key).delete(delete_api_key))
        .route("/admin/api-keys/:id/revoke",     patch(revoke_api_key))
        // Webhooks
        .route("/admin/webhooks",                get(list_webhooks).post(create_webhook))
        .route("/admin/webhooks/:id",            get(get_webhook).put(update_webhook).delete(delete_webhook))
        .route("/admin/webhooks/:id/test",       post(test_webhook))
        .route("/admin/webhooks/:id/pause",      patch(pause_webhook))
        .route("/admin/webhooks/:id/activate",   patch(activate_webhook))
        .route("/admin/webhooks/:id/deliveries", get(list_webhook_deliveries))
        .route("/admin/webhooks/:id/deliveries/:delivery_id/retry", post(retry_delivery))
        // Resource Limits
        .route("/admin/resource-limits",         get(list_resource_limits).post(create_resource_limit))
        .route("/admin/resource-limits/:id",     put(update_resource_limit).delete(delete_resource_limit))
        // Settings
        .route("/admin/settings",                get(get_settings).put(update_settings))
        .route("/admin/branding",                get(get_branding).put(update_branding))
        .route("/admin/branding/verify-domain",  post(verify_domain))
        // Data Retention
        .route("/admin/data-retention/policies", get(get_retention_policies).put(update_retention_policies))
        .route("/admin/data-retention/purge/:data_type", post(manual_purge))
        .route("/admin/data-retention/deletion-requests", get(list_deletion_requests).post(create_deletion_request))
        // Export
        .route("/admin/export/all",              get(export_all_data))
        // API Docs
        .route("/admin/api-docs/endpoints",      get(list_api_endpoints))
        .route("/admin/api-docs/openapi.json",   get(openapi_spec))
        // Protege todas as rotas com middleware de admin
        .layer(middleware::from_fn(require_admin_role))
}

// ─── Params ────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct PeriodQuery {
    pub period: Option<String>, // 7d | 30d | 90d
}

#[derive(Deserialize)]
pub struct PaginationQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct LimitQuery {
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct AuditQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub category: Option<String>,
    pub severity: Option<String>,
    pub user_id: Option<Uuid>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub search: Option<String>,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

pub async fn system_health(
    State(app): State<AppState>,
) -> Result<Json<SystemHealth>, StatusCode> {
    let health = app.admin_service.get_system_health().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(health))
}

pub async fn gpu_status(
    State(app): State<AppState>,
) -> Result<Json<GpuInfo>, StatusCode> {
    let info = app.admin_service.get_gpu_status().await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(info))
}

pub async fn pending_alerts(
    State(app): State<AppState>,
) -> Result<Json<Vec<AdminAlert>>, StatusCode> {
    let alerts = app.admin_service.get_pending_alerts().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(alerts))
}

pub async fn usage_metrics(
    State(app): State<AppState>,
    Query(q): Query<PeriodQuery>,
) -> Result<Json<UsageMetrics>, StatusCode> {
    let period = q.period.unwrap_or_else(|| "30d".to_string());
    let metrics = app.admin_service.get_usage_metrics(&period).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(metrics))
}

pub async fn daily_metrics(
    State(app): State<AppState>,
    Query(q): Query<PeriodQuery>,
) -> Result<Json<Vec<DailyMetric>>, StatusCode> {
    let period = q.period.unwrap_or_else(|| "30d".to_string());
    let data = app.admin_service.get_daily_metrics(&period).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(data))
}

pub async fn top_projects(
    State(app): State<AppState>,
    Query(q): Query<LimitQuery>,
) -> Result<Json<Vec<ProjectMetric>>, StatusCode> {
    let limit = q.limit.unwrap_or(5);
    let data = app.admin_service.get_top_projects(limit).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(data))
}

pub async fn top_users(
    State(app): State<AppState>,
    Query(q): Query<LimitQuery>,
) -> Result<Json<Vec<UserMetric>>, StatusCode> {
    let limit = q.limit.unwrap_or(5);
    let data = app.admin_service.get_top_users(limit).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(data))
}

pub async fn export_metrics(
    State(app): State<AppState>,
    Query(q): Query<PeriodQuery>,
) -> Result<String, StatusCode> {
    let period = q.period.unwrap_or_else(|| "30d".to_string());
    let csv = app.admin_service.export_metrics_csv(&period).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(csv)
}

pub async fn list_users(
    State(app): State<AppState>,
) -> Result<Json<Vec<WorkspaceUserRow>>, StatusCode> {
    let users = app.admin_service.list_users().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(users))
}

pub async fn get_user(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkspaceUserRow>, StatusCode> {
    let user = app.admin_service.get_user(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(user))
}

#[derive(Deserialize)]
pub struct InviteUserBody {
    email: String,
    role_id: String,
    project_ids: Vec<Uuid>,
}

pub async fn invite_user(
    State(app): State<AppState>,
    Json(body): Json<InviteUserBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.invite_user(&body.email, &body.role_id, &body.project_ids).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn update_user(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_user(id, body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn suspend_user(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.set_user_status(id, "suspended").await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn activate_user(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.set_user_status(id, "active").await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn export_users(
    State(app): State<AppState>,
) -> Result<String, StatusCode> {
    let csv = app.admin_service.export_users_csv().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(csv)
}

pub async fn list_roles(
    State(app): State<AppState>,
) -> Result<Json<Vec<RoleRow>>, StatusCode> {
    let roles = app.admin_service.list_roles().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(roles))
}

pub async fn create_role(
    State(app): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<RoleRow>, StatusCode> {
    let role = app.admin_service.create_role(body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(role))
}

pub async fn update_role(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_role(id, body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn delete_role(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.delete_role(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_sessions(
    State(app): State<AppState>,
) -> Result<Json<Vec<SessionRow>>, StatusCode> {
    let sessions = app.admin_service.list_active_sessions().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(sessions))
}

pub async fn terminate_session(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.terminate_session(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct TerminateAllBody {
    except_session_id: Uuid,
}

pub async fn terminate_all_sessions(
    State(app): State<AppState>,
    Json(body): Json<TerminateAllBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let count = app.admin_service.terminate_all_sessions(body.except_session_id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "terminated": count })))
}

pub async fn query_audit_logs(
    State(app): State<AppState>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<AuditPage>, StatusCode> {
    let page = app.admin_service.query_audit_logs(q.into()).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(page))
}

pub async fn export_audit_csv(
    State(app): State<AppState>,
    Query(q): Query<AuditQuery>,
) -> Result<String, StatusCode> {
    let csv = app.admin_service.export_audit_csv(q.into()).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(csv)
}

pub async fn compliance_report(
    State(app): State<AppState>,
) -> Result<Json<ComplianceReport>, StatusCode> {
    let report = app.admin_service.generate_compliance_report().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(report))
}

pub async fn list_models(
    State(app): State<AppState>,
) -> Result<Json<Vec<AiModelConfig>>, StatusCode> {
    let models = app.admin_service.list_models().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(models))
}

pub async fn update_model_config(
    State(app): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_model_config(&id, body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_lora_adapters(
    State(app): State<AppState>,
) -> Result<Json<Vec<LoraAdapter>>, StatusCode> {
    let adapters = app.admin_service.list_lora_adapters().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(adapters))
}

pub async fn deploy_lora(
    State(app): State<AppState>,
    Path(version): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.deploy_lora(&version).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true, "version": version })))
}

pub async fn rollback_lora(
    State(app): State<AppState>,
    Path(version): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.rollback_lora(&version).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn start_training(
    State(app): State<AppState>,
) -> Result<Json<TrainingBatch>, StatusCode> {
    let batch = app.admin_service.start_training_batch().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(batch))
}

pub async fn training_status(
    State(app): State<AppState>,
) -> Result<Json<TrainingBatch>, StatusCode> {
    let batch = app.admin_service.get_latest_training_batch().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(batch))
}

pub async fn get_rag_config(
    State(app): State<AppState>,
) -> Result<Json<RagConfig>, StatusCode> {
    let config = app.admin_service.get_rag_config().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(config))
}

pub async fn update_rag_config(
    State(app): State<AppState>,
    Json(body): Json<RagConfig>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_rag_config(body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_api_keys(
    State(app): State<AppState>,
) -> Result<Json<Vec<ApiKeyRow>>, StatusCode> {
    let keys = app.admin_service.list_api_keys().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(keys))
}

#[derive(Deserialize)]
pub struct CreateApiKeyBody {
    name: String,
    permissions: Vec<String>,
    rate_limit: i32,
    expires_at: Option<String>,
}

pub async fn create_api_key(
    State(app): State<AppState>,
    Json(body): Json<CreateApiKeyBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let (key_row, raw_key) = app.admin_service
        .create_api_key(&body.name, &body.permissions, body.rate_limit, body.expires_at.as_deref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    // Retorna a chave crua APENAS aqui — nunca mais será exposta
    Ok(Json(serde_json::json!({ "key": raw_key, "id": key_row.id })))
}

pub async fn update_api_key(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_api_key(id, body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn delete_api_key(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.delete_api_key(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn revoke_api_key(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.revoke_api_key(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_webhooks(
    State(app): State<AppState>,
) -> Result<Json<Vec<WebhookRow>>, StatusCode> {
    let wh = app.admin_service.list_webhooks().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(wh))
}

pub async fn get_webhook(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<WebhookRow>, StatusCode> {
    let wh = app.admin_service.get_webhook(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(wh))
}

pub async fn create_webhook(
    State(app): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<WebhookRow>, StatusCode> {
    let wh = app.admin_service.create_webhook(body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(wh))
}

pub async fn update_webhook(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_webhook(id, body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn delete_webhook(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.delete_webhook(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn test_webhook(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.test_webhook(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn pause_webhook(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.set_webhook_status(id, "paused").await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn activate_webhook(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.set_webhook_status(id, "active").await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_webhook_deliveries(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<PaginationQuery>,
) -> Result<Json<Vec<WebhookDelivery>>, StatusCode> {
    let deliveries = app.admin_service
        .list_webhook_deliveries(id, q.page.unwrap_or(1), q.per_page.unwrap_or(20), q.status.as_deref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(deliveries))
}

pub async fn retry_delivery(
    State(app): State<AppState>,
    Path((webhook_id, delivery_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.retry_webhook_delivery(webhook_id, delivery_id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_resource_limits(
    State(app): State<AppState>,
) -> Result<Json<Vec<ResourceLimitRow>>, StatusCode> {
    let limits = app.admin_service.list_resource_limits().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(limits))
}

pub async fn create_resource_limit(
    State(app): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<ResourceLimitRow>, StatusCode> {
    let limit = app.admin_service.create_resource_limit(body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(limit))
}

pub async fn update_resource_limit(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_resource_limit(id, body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn delete_resource_limit(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.delete_resource_limit(id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn get_settings(
    State(app): State<AppState>,
) -> Result<Json<WorkspaceSettings>, StatusCode> {
    let settings = app.admin_service.get_settings().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(settings))
}

pub async fn update_settings(
    State(app): State<AppState>,
    Json(body): Json<WorkspaceSettings>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_settings(body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn get_branding(
    State(app): State<AppState>,
) -> Result<Json<BrandingConfig>, StatusCode> {
    let branding = app.admin_service.get_branding().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(branding))
}

pub async fn update_branding(
    State(app): State<AppState>,
    Json(body): Json<BrandingConfig>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_branding(body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct VerifyDomainBody {
    domain: String,
}

pub async fn verify_domain(
    State(app): State<AppState>,
    Json(body): Json<VerifyDomainBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let status = app.admin_service.verify_domain(&body.domain).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "status": status })))
}

pub async fn get_retention_policies(
    State(app): State<AppState>,
) -> Result<Json<Vec<RetentionPolicy>>, StatusCode> {
    let policies = app.admin_service.get_retention_policies().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(policies))
}

pub async fn update_retention_policies(
    State(app): State<AppState>,
    Json(body): Json<Vec<RetentionPolicy>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_retention_policies(body).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn manual_purge(
    State(app): State<AppState>,
    Path(data_type): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let count = app.admin_service.manual_purge(&data_type).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "deleted": count })))
}

pub async fn list_deletion_requests(
    State(app): State<AppState>,
) -> Result<Json<Vec<DeletionRequest>>, StatusCode> {
    let requests = app.admin_service.list_deletion_requests().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(requests))
}

#[derive(Deserialize)]
pub struct CreateDeletionRequestBody {
    target_name: String,
    r#type: String,
}

pub async fn create_deletion_request(
    State(app): State<AppState>,
    Json(body): Json<CreateDeletionRequestBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.create_deletion_request(&body.target_name, &body.r#type).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn export_all_data(
    State(app): State<AppState>,
) -> Result<Vec<u8>, StatusCode> {
    let zip = app.admin_service.export_all_data().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(zip)
}

pub async fn list_api_endpoints(
    State(app): State<AppState>,
) -> Result<Json<Vec<ApiEndpointDoc>>, StatusCode> {
    let endpoints = app.admin_service.list_api_endpoints().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(endpoints))
}

pub async fn openapi_spec(
    State(app): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let spec = app.admin_service.get_openapi_spec().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(spec))
}
