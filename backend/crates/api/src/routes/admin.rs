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

// Sprint 2 (Grupo B): routes/admin.rs agora é thin — delega para os services.
// admin_service  → AdminService
// user_service   → UserService
// audit_service  → AuditService

// ─── Router ─────────────────────────────────────────────────────────────────────────────────

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
        // Users → user_service
        .route("/admin/users",                   get(list_users).post(invite_user))
        .route("/admin/users/:id",               get(get_user).put(update_user))
        .route("/admin/users/:id/suspend",       post(suspend_user))
        .route("/admin/users/:id/activate",      post(activate_user))
        .route("/admin/users/export",            get(export_users))
        // Roles & Permissions → user_service
        .route("/admin/roles",                   get(list_roles).post(create_role))
        .route("/admin/roles/:id",               put(update_role).delete(delete_role))
        // Sessions → user_service
        .route("/admin/sessions",                get(list_sessions))
        .route("/admin/sessions/:id",            delete(terminate_session))
        .route("/admin/sessions/terminate-all",  post(terminate_all_sessions))
        // Audit → audit_service
        .route("/admin/audit",                   get(query_audit_logs))
        .route("/admin/audit/export",            get(export_audit_csv))
        .route("/admin/compliance-report",       get(compliance_report))
        // AI Config → admin_service
        .route("/admin/ai/models",               get(list_models))
        .route("/admin/ai/models/:id",           put(update_model_config))
        .route("/admin/ai/lora",                 get(list_lora_adapters))
        .route("/admin/ai/lora/:version/deploy", post(deploy_lora))
        .route("/admin/ai/lora/:version/rollback",post(rollback_lora))
        .route("/admin/ai/training/start",       post(start_training))
        .route("/admin/ai/training/status",      get(training_status))
        .route("/admin/ai/rag-config",           get(get_rag_config).put(update_rag_config))
        // API Keys → admin_service
        .route("/admin/api-keys",                get(list_api_keys).post(create_api_key))
        .route("/admin/api-keys/:id",            put(update_api_key).delete(delete_api_key))
        .route("/admin/api-keys/:id/revoke",     patch(revoke_api_key))
        // Webhooks → admin_service
        .route("/admin/webhooks",                get(list_webhooks).post(create_webhook))
        .route("/admin/webhooks/:id",            get(get_webhook).put(update_webhook).delete(delete_webhook))
        .route("/admin/webhooks/:id/test",       post(test_webhook))
        .route("/admin/webhooks/:id/pause",      patch(pause_webhook))
        .route("/admin/webhooks/:id/activate",   patch(activate_webhook))
        .route("/admin/webhooks/:id/deliveries", get(list_webhook_deliveries))
        .route("/admin/webhooks/:id/deliveries/:delivery_id/retry", post(retry_delivery))
        // Resource Limits → admin_service
        .route("/admin/resource-limits",         get(list_resource_limits).post(create_resource_limit))
        .route("/admin/resource-limits/:id",     put(update_resource_limit).delete(delete_resource_limit))
        // Settings → admin_service
        .route("/admin/settings",                get(get_settings).put(update_settings))
        .route("/admin/branding",                get(get_branding).put(update_branding))
        .route("/admin/branding/verify-domain",  post(verify_domain))
        // Data Retention → audit_service
        .route("/admin/data-retention/policies", get(get_retention_policies).put(update_retention_policies))
        .route("/admin/data-retention/purge/:data_type", post(manual_purge))
        .route("/admin/data-retention/deletion-requests", get(list_deletion_requests).post(create_deletion_request))
        // Export & API Docs → admin_service
        .route("/admin/export/all",              get(export_all_data))
        .route("/admin/api-docs/endpoints",      get(list_api_endpoints))
        .route("/admin/api-docs/openapi.json",   get(openapi_spec))
        .layer(middleware::from_fn(require_admin_role))
}

// ─── Params ────────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct PeriodQuery { pub period: Option<String> }

#[derive(Deserialize)]
pub struct PaginationQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct LimitQuery { pub limit: Option<i64> }

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

// ─── Handlers ───────────────────────────────────────────────────────────────────────────────

// ── admin_service handlers ──────────────────────────────────────────────────

pub async fn system_health(State(app): State<AppState>) -> Result<Json<SystemHealth>, StatusCode> {
    app.admin_service.get_system_health().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn gpu_status(State(app): State<AppState>) -> Result<Json<GpuInfo>, StatusCode> {
    app.admin_service.get_gpu_status().await.map(Json).map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
}
pub async fn pending_alerts(State(app): State<AppState>) -> Result<Json<Vec<AdminAlert>>, StatusCode> {
    app.admin_service.get_pending_alerts().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn usage_metrics(State(app): State<AppState>, Query(q): Query<PeriodQuery>) -> Result<Json<UsageMetrics>, StatusCode> {
    app.admin_service.get_usage_metrics(&q.period.unwrap_or_else(|| "30d".into())).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn daily_metrics(State(app): State<AppState>, Query(q): Query<PeriodQuery>) -> Result<Json<Vec<DailyMetric>>, StatusCode> {
    app.admin_service.get_daily_metrics(&q.period.unwrap_or_else(|| "30d".into())).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn top_projects(State(app): State<AppState>, Query(q): Query<LimitQuery>) -> Result<Json<Vec<ProjectMetric>>, StatusCode> {
    app.admin_service.get_top_projects(q.limit.unwrap_or(5)).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn top_users(State(app): State<AppState>, Query(q): Query<LimitQuery>) -> Result<Json<Vec<UserMetric>>, StatusCode> {
    app.admin_service.get_top_users(q.limit.unwrap_or(5)).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn export_metrics(State(app): State<AppState>, Query(q): Query<PeriodQuery>) -> Result<String, StatusCode> {
    app.admin_service.export_metrics_csv(&q.period.unwrap_or_else(|| "30d".into())).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn list_models(State(app): State<AppState>) -> Result<Json<Vec<AiModelConfig>>, StatusCode> {
    app.admin_service.list_models().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn update_model_config(State(app): State<AppState>, Path(id): Path<String>, Json(body): Json<serde_json::Value>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_model_config(&id, body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn list_lora_adapters(State(app): State<AppState>) -> Result<Json<Vec<LoraAdapter>>, StatusCode> {
    app.admin_service.list_lora_adapters().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn deploy_lora(State(app): State<AppState>, Path(v): Path<String>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.deploy_lora(&v).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true, "version": v })))
}
pub async fn rollback_lora(State(app): State<AppState>, Path(v): Path<String>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.rollback_lora(&v).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn start_training(State(app): State<AppState>) -> Result<Json<TrainingBatch>, StatusCode> {
    app.admin_service.start_training_batch().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn training_status(State(app): State<AppState>) -> Result<Json<TrainingBatch>, StatusCode> {
    app.admin_service.get_latest_training_batch().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn get_rag_config(State(app): State<AppState>) -> Result<Json<RagConfig>, StatusCode> {
    app.admin_service.get_rag_config().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn update_rag_config(State(app): State<AppState>, Json(body): Json<RagConfig>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_rag_config(body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn list_api_keys(State(app): State<AppState>) -> Result<Json<Vec<ApiKeyRow>>, StatusCode> {
    app.admin_service.list_api_keys().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
#[derive(Deserialize)]
pub struct CreateApiKeyBody { name: String, permissions: Vec<String>, rate_limit: i32, expires_at: Option<String> }
pub async fn create_api_key(State(app): State<AppState>, Json(body): Json<CreateApiKeyBody>) -> Result<Json<serde_json::Value>, StatusCode> {
    let (row, raw) = app.admin_service.create_api_key(&body.name, &body.permissions, body.rate_limit, body.expires_at.as_deref()).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "key": raw, "id": row.id })))
}
pub async fn update_api_key(State(app): State<AppState>, Path(id): Path<Uuid>, Json(body): Json<serde_json::Value>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_api_key(id, body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn delete_api_key(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.delete_api_key(id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn revoke_api_key(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.revoke_api_key(id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn list_webhooks(State(app): State<AppState>) -> Result<Json<Vec<WebhookRow>>, StatusCode> {
    app.admin_service.list_webhooks().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn get_webhook(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<WebhookRow>, StatusCode> {
    app.admin_service.get_webhook(id).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn create_webhook(State(app): State<AppState>, Json(body): Json<serde_json::Value>) -> Result<Json<WebhookRow>, StatusCode> {
    app.admin_service.create_webhook(body).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn update_webhook(State(app): State<AppState>, Path(id): Path<Uuid>, Json(body): Json<serde_json::Value>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_webhook(id, body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn delete_webhook(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.delete_webhook(id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn test_webhook(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.test_webhook(id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn pause_webhook(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.set_webhook_status(id, "paused").await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn activate_webhook(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.set_webhook_status(id, "active").await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn list_webhook_deliveries(State(app): State<AppState>, Path(id): Path<Uuid>, Query(q): Query<PaginationQuery>) -> Result<Json<Vec<WebhookDelivery>>, StatusCode> {
    app.admin_service.list_webhook_deliveries(id, q.page.unwrap_or(1), q.per_page.unwrap_or(20), q.status.as_deref()).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn retry_delivery(State(app): State<AppState>, Path((wid, did)): Path<(Uuid,Uuid)>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.retry_webhook_delivery(wid, did).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn list_resource_limits(State(app): State<AppState>) -> Result<Json<Vec<ResourceLimitRow>>, StatusCode> {
    app.admin_service.list_resource_limits().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn create_resource_limit(State(app): State<AppState>, Json(body): Json<serde_json::Value>) -> Result<Json<ResourceLimitRow>, StatusCode> {
    app.admin_service.create_resource_limit(body).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn update_resource_limit(State(app): State<AppState>, Path(id): Path<Uuid>, Json(body): Json<serde_json::Value>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_resource_limit(id, body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn delete_resource_limit(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.delete_resource_limit(id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn get_settings(State(app): State<AppState>) -> Result<Json<WorkspaceSettings>, StatusCode> {
    app.admin_service.get_settings().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn update_settings(State(app): State<AppState>, Json(body): Json<WorkspaceSettings>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_settings(body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn get_branding(State(app): State<AppState>) -> Result<Json<BrandingConfig>, StatusCode> {
    app.admin_service.get_branding().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn update_branding(State(app): State<AppState>, Json(body): Json<BrandingConfig>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.update_branding(body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
#[derive(Deserialize)]
pub struct VerifyDomainBody { domain: String }
pub async fn verify_domain(State(app): State<AppState>, Json(body): Json<VerifyDomainBody>) -> Result<Json<serde_json::Value>, StatusCode> {
    let status = app.admin_service.verify_domain(&body.domain).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "status": status })))
}
pub async fn export_all_data(State(app): State<AppState>) -> Result<Vec<u8>, StatusCode> {
    app.admin_service.export_all_data().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn list_api_endpoints(State(app): State<AppState>) -> Result<Json<Vec<ApiEndpointDoc>>, StatusCode> {
    app.admin_service.list_api_endpoints().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn openapi_spec(State(app): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.admin_service.get_openapi_spec().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

// ── user_service handlers ─────────────────────────────────────────────────────────────────────────

pub async fn list_users(State(app): State<AppState>) -> Result<Json<Vec<WorkspaceUserRow>>, StatusCode> {
    app.user_service.list_users().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn get_user(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<WorkspaceUserRow>, StatusCode> {
    app.user_service.get_user(id).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
#[derive(Deserialize)]
pub struct InviteUserBody { email: String, role_id: String, project_ids: Vec<Uuid> }
pub async fn invite_user(State(app): State<AppState>, Json(body): Json<InviteUserBody>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.user_service.invite_user(&body.email, &body.role_id, &body.project_ids).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn update_user(State(app): State<AppState>, Path(id): Path<Uuid>, Json(body): Json<serde_json::Value>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.user_service.update_user(id, body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn suspend_user(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.user_service.set_user_status(id, "suspended").await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn activate_user(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.user_service.set_user_status(id, "active").await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn export_users(State(app): State<AppState>) -> Result<String, StatusCode> {
    app.user_service.export_users_csv().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn list_roles(State(app): State<AppState>) -> Result<Json<Vec<RoleRow>>, StatusCode> {
    app.user_service.list_roles().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn create_role(State(app): State<AppState>, Json(body): Json<serde_json::Value>) -> Result<Json<RoleRow>, StatusCode> {
    app.user_service.create_role(body).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn update_role(State(app): State<AppState>, Path(id): Path<Uuid>, Json(body): Json<serde_json::Value>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.user_service.update_role(id, body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn delete_role(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.user_service.delete_role(id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn list_sessions(State(app): State<AppState>) -> Result<Json<Vec<SessionRow>>, StatusCode> {
    app.user_service.list_active_sessions().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn terminate_session(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.user_service.terminate_session(id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
#[derive(Deserialize)]
pub struct TerminateAllBody { except_session_id: Uuid }
pub async fn terminate_all_sessions(State(app): State<AppState>, Json(body): Json<TerminateAllBody>) -> Result<Json<serde_json::Value>, StatusCode> {
    let count = app.user_service.terminate_all_sessions(body.except_session_id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "terminated": count })))
}

// ── audit_service handlers ───────────────────────────────────────────────────────────────────────

pub async fn query_audit_logs(State(app): State<AppState>, Query(q): Query<AuditQuery>) -> Result<Json<AuditPage>, StatusCode> {
    app.audit_service.query_audit_logs(q.into()).await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn export_audit_csv(State(app): State<AppState>, Query(q): Query<AuditQuery>) -> Result<String, StatusCode> {
    app.audit_service.export_audit_csv(q.into()).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn compliance_report(State(app): State<AppState>) -> Result<Json<ComplianceReport>, StatusCode> {
    app.audit_service.generate_compliance_report().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn get_retention_policies(State(app): State<AppState>) -> Result<Json<Vec<RetentionPolicy>>, StatusCode> {
    app.audit_service.get_retention_policies().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
pub async fn update_retention_policies(State(app): State<AppState>, Json(body): Json<Vec<RetentionPolicy>>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.audit_service.update_retention_policies(body).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
pub async fn manual_purge(State(app): State<AppState>, Path(dt): Path<String>) -> Result<Json<serde_json::Value>, StatusCode> {
    let count = app.audit_service.manual_purge(&dt).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "deleted": count })))
}
pub async fn list_deletion_requests(State(app): State<AppState>) -> Result<Json<Vec<DeletionRequest>>, StatusCode> {
    app.audit_service.list_deletion_requests().await.map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
#[derive(Deserialize)]
pub struct CreateDeletionRequestBody { target_name: String, r#type: String }
pub async fn create_deletion_request(State(app): State<AppState>, Json(body): Json<CreateDeletionRequestBody>) -> Result<Json<serde_json::Value>, StatusCode> {
    app.audit_service.create_deletion_request(&body.target_name, &body.r#type).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
