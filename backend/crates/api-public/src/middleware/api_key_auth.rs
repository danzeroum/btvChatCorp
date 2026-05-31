use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::api_key::{ApiKeyContext, ApiKeyPermission, ProjectScope};
use crate_api::security::{hash_api_key_hmac, hash_api_key_sha256};
use crate_api::state::AppState;

#[derive(FromRow)]
struct ApiKeyRow {
    id: Uuid,
    workspace_id: Uuid,
    name: String,
    permissions: Option<serde_json::Value>,
    project_scope: Option<String>,
    allowed_project_ids: Option<serde_json::Value>,
    rate_limit: Option<i32>,
    created_by: Option<Uuid>,
}

/// Middleware de autenticação por API Key para a API Pública.
pub async fn api_key_auth(
    State(app): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let api_key = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !api_key.starts_with("sk_live_") && !api_key.starts_with("sk_test_") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let hmac_hash = hash_api_key_hmac(api_key, &app.api_key_hmac_secret);
    let legacy_hash = hash_api_key_sha256(api_key);

    let record = sqlx::query_as::<_, ApiKeyRow>(
        r#"SELECT id, workspace_id, name, permissions, project_scope,
                  allowed_project_ids, rate_limit, status, created_by
           FROM api_keys
           WHERE (key_hash = $1 OR key_hash = $2) AND status = 'active'"#,
    )
    .bind(&hmac_hash)
    .bind(&legacy_hash)
    .fetch_optional(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::UNAUTHORIZED)?;

    let db = app.db.clone();
    let key_id_update = record.id;
    tokio::spawn(async move {
        let _ = sqlx::query(
            "UPDATE api_keys SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = $1",
        )
        .bind(key_id_update)
        .execute(&db)
        .await;
    });

    let permissions: Vec<ApiKeyPermission> = serde_json::from_value(
        record.permissions.unwrap_or(serde_json::Value::Array(vec![])),
    )
    .unwrap_or_default();

    let project_scope = match record.project_scope.as_deref() {
        Some("specific") => {
            let ids: Vec<String> = serde_json::from_value(
                record.allowed_project_ids.unwrap_or(serde_json::Value::Array(vec![])),
            )
            .unwrap_or_default();
            ProjectScope::Specific(ids)
        }
        _ => ProjectScope::All,
    };

    let ctx = ApiKeyContext {
        key_id: record.id.to_string(),
        workspace_id: record.workspace_id,
        key_name: record.name,
        permissions,
        project_scope,
        rate_limit: record.rate_limit.unwrap_or(60) as u32,
        user_id: record.created_by,
    };

    request.extensions_mut().insert(ctx);
    Ok(next.run(request).await)
}
