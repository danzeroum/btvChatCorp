//! Middleware de autenticacao por API key (Bearer token).
//!
//! Fluxo:
//!   1. Extrai header Authorization: Bearer <key>
//!   2. Busca a key hash (SHA-256) na tabela api_keys
//!   3. Verifica ativa=true e workspace_id existente
//!   4. Injeta workspace_id no request via Extension

use axum::{
    body::Body,
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Json, Response},
};
use sha2::{Digest, Sha256};

use crate::state::GatewayState;

#[derive(Clone, Debug)]
pub struct AuthenticatedKey {
    pub workspace_id: uuid::Uuid,
    pub key_id: uuid::Uuid,
}

pub async fn api_key_middleware(
    State(state): State<GatewayState>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    // Bypass em healthcheck
    if req.uri().path() == "/health" || req.uri().path().starts_with("/docs") {
        return next.run(req).await;
    }

    let key = match extract_bearer(req.headers()) {
        Some(k) => k,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": { "message": "API key ausente", "type": "invalid_request_error", "code": "missing_api_key" }
                })),
            )
                .into_response();
        }
    };

    let key_hash = format!("{:x}", Sha256::digest(key.as_bytes()));

    let row = sqlx::query!(
        "SELECT id, workspace_id FROM api_keys WHERE key_hash = $1 AND ativa = true LIMIT 1",
        key_hash
    )
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => {
            req.extensions_mut().insert(AuthenticatedKey {
                workspace_id: r.workspace_id,
                key_id: r.id,
            });
            next.run(req).await
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": { "message": "API key invalida ou inativa", "type": "invalid_request_error", "code": "invalid_api_key" }
            })),
        )
            .into_response(),
    }
}

fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.trim().to_string())
}
