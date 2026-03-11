use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
    Json,
};
use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{errors::error_response, state::AppState};

// ─── Contexto da API Key autenticada ─────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ApiKeyContext {
    pub key_id: Uuid,
    pub workspace_id: Uuid,
    pub key_name: String,
    pub permissions: Vec<ApiKeyPermission>,
    pub project_scope: ProjectScope,
    pub rate_limit_rpm: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyPermission {
    pub resource: String,  // "chat", "documents", "search"…
    pub actions: Vec<String>, // "read", "write", "delete"
}

#[derive(Debug, Clone)]
pub enum ProjectScope {
    All,
    Specific(Vec<Uuid>),
}

impl ApiKeyContext {
    /// Verifica se esta key tem permissão para um recurso+ação
    pub fn has_permission(&self, resource: &str, action: &str) -> bool {
        self.permissions.iter().any(|p| {
            p.resource == resource && p.actions.iter().any(|a| a == action)
        })
    }
}

// ─── Registro da API Key no banco ─────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct ApiKeyRecord {
    id: Uuid,
    workspace_id: Uuid,
    name: String,
    permissions: serde_json::Value,
    project_scope: String,
    allowed_project_ids: Option<serde_json::Value>,
    rate_limit_rpm: i32,
    status: String,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
    allowed_ips: Option<serde_json::Value>,
}

// ─── Middleware ───────────────────────────────────────────────────────────

/// Middleware Axum que valida a API Key no header `Authorization: Bearer sk-live-xxx`.
/// Injeta `ApiKeyContext` nas extensions da request.
pub async fn api_key_auth(
    State(app): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, Json<crate::errors::ApiError>)> {
    // ── Extrai e valida formato ───────────────────────────────────────────
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| error_response(
            StatusCode::UNAUTHORIZED,
            "missing_api_key",
            "Authorization header with Bearer token is required",
        ))?;

    let api_key = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| error_response(
            StatusCode::UNAUTHORIZED,
            "invalid_auth_format",
            "Expected: Authorization: Bearer sk-live-xxx",
        ))?;

    if !api_key.starts_with("sk-live-") && !api_key.starts_with("sk-test-") {
        return Err(error_response(
            StatusCode::UNAUTHORIZED,
            "invalid_key_format",
            "API key must start with sk-live- or sk-test-",
        ));
    }

    // ── Busca key no banco por hash (nunca armazenamos a key em texto) ──────
    let key_hash = hash_api_key(api_key);
    let record = sqlx::query_as::<_, ApiKeyRecord>(
        r#"
        SELECT id, workspace_id, name, permissions,
               project_scope, allowed_project_ids,
               rate_limit_rpm, status, expires_at, allowed_ips
        FROM api_keys
        WHERE key_hash = $1
        "#,
    )
    .bind(&key_hash)
    .fetch_optional(&app.db)
    .await
    .map_err(|_| error_response(
        StatusCode::INTERNAL_SERVER_ERROR,
        "db_error",
        "Database lookup failed",
    ))?
    .ok_or_else(|| error_response(
        StatusCode::UNAUTHORIZED,
        "invalid_api_key",
        "The provided API key is invalid or has been revoked",
    ))?;

    // ── Valida status ─────────────────────────────────────────────────────
    if record.status != "active" {
        return Err(error_response(
            StatusCode::UNAUTHORIZED,
            "key_inactive",
            format!("API key is {}", record.status),
        ));
    }

    // ── Valida expiração ────────────────────────────────────────────────
    if let Some(exp) = record.expires_at {
        if chrono::Utc::now() > exp {
            return Err(error_response(
                StatusCode::UNAUTHORIZED,
                "key_expired",
                "This API key has expired",
            ));
        }
    }

    // ── Atualiza last_used_at (async, não bloqueia) ───────────────────────
    let db_clone = app.db.clone();
    let key_id = record.id;
    tokio::spawn(async move {
        let _ = sqlx::query!("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", key_id)
            .execute(&db_clone)
            .await;
    });

    // ── Monta contexto e injeta nas extensions ───────────────────────────
    let permissions: Vec<ApiKeyPermission> = record
        .permissions
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| serde_json::from_value(v.clone()).ok())
        .collect();

    let project_scope = if record.project_scope == "all" {
        ProjectScope::All
    } else {
        let ids: Vec<Uuid> = record
            .allowed_project_ids
            .as_ref()
            .and_then(|v| v.as_array())
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str().and_then(|s| s.parse().ok()))
            .collect();
        ProjectScope::Specific(ids)
    };

    let ctx = ApiKeyContext {
        key_id: record.id,
        workspace_id: record.workspace_id,
        key_name: record.name,
        permissions,
        project_scope,
        rate_limit_rpm: record.rate_limit_rpm as u32,
    };

    request.extensions_mut().insert(ctx);
    Ok(next.run(request).await)
}

/// Gera SHA-256 hex da API key (nunca armazenamos em texto)
pub fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}
