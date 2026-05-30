use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

use crate::models::api_key::{ApiKeyContext, ApiKeyPermission, ProjectScope};
// Re-exporta do crate api
use crate_api::state::AppState;

/// Middleware de autenticação por API Key para a API Pública.
/// Extrai o token do header `Authorization: Bearer sk_live_...`,
/// valida contra o hash no banco, e injeta `ApiKeyContext` nas extensions.
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

    // Valida formato (sk_live_ ou sk_test_)
    if !api_key.starts_with("sk_live_") && !api_key.starts_with("sk_test_") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Lookup seguro por hash. Aceita HMAC (atual) e SHA-256 puro (legado) durante
    // a janela de migração das keys.
    let hmac_hash = hash_api_key_hmac(api_key, &app.api_key_hmac_secret);
    let legacy_hash = hash_api_key_sha256(api_key);

    let record = sqlx::query!(
        r#"
        SELECT id, workspace_id, name, permissions, project_scope,
               allowed_project_ids, rate_limit, status
        FROM api_keys
        WHERE (key_hash = $1 OR key_hash = $2) AND status = 'active'
        "#,
        hmac_hash,
        legacy_hash,
    )
    .fetch_optional(&app.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::UNAUTHORIZED)?;

    // Atualiza last_used_at de forma não-bloqueante
    let db = app.db.clone();
    let key_id = record.id.to_string();
    tokio::spawn(async move {
        let _ = sqlx::query!(
            "UPDATE api_keys SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = $1",
            record.id,
        )
        .execute(&db)
        .await;
    });

    // Parse das permissões (armazenadas como JSONB)
    let permissions: Vec<ApiKeyPermission> = serde_json::from_value(
        record.permissions.unwrap_or(serde_json::Value::Array(vec![]))
    ).unwrap_or_default();

    let project_scope = match record.project_scope.as_deref() {
        Some("specific") => {
            let ids: Vec<String> = serde_json::from_value(
                record.allowed_project_ids.unwrap_or(serde_json::Value::Array(vec![]))
            ).unwrap_or_default();
            ProjectScope::Specific(ids)
        }
        _ => ProjectScope::All,
    };

    let ctx = ApiKeyContext {
        key_id,
        workspace_id: record.workspace_id,
        key_name: record.name,
        permissions,
        project_scope,
        rate_limit: record.rate_limit.unwrap_or(60) as u32,
    };

    request.extensions_mut().insert(ctx);
    Ok(next.run(request).await)
}

/// HMAC-SHA256 da API key — formato atual (com segredo da aplicação).
// NOTA: duplicado de `api::security` porque este crate ainda está fora do workspace
// Cargo (ver C12). Após a unificação do workspace, importar de um util compartilhado.
pub fn hash_api_key_hmac(key: &str, secret: &str) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC aceita chave de qualquer tamanho");
    mac.update(key.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// SHA-256 puro — formato LEGADO, apenas para fallback durante a migração.
pub fn hash_api_key_sha256(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}
