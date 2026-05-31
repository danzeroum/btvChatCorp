use axum::{
    body::Body,
    extract::State,
    http::{header, Request, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::extractors::WorkspaceContext;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub workspace_id: String,
    pub role: String,
    pub exp: usize,
    /// Issuer — presente em tokens novos; omitido em legados (serde default)
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub iss: String,
    /// Audience — presente em tokens novos; omitido em legados (serde default)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub aud: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub workspace_id: Uuid,
    #[allow(dead_code)]
    pub role: String,
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v: &axum::http::HeaderValue| v.to_str().ok())
        .and_then(|v: &str| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Validacao de iss/aud sera enforced em versao futura apos rotacao de tokens
    let validation = Validation::new(Algorithm::HS256);

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let c = token_data.claims;
    let user_id: Uuid = c.sub.parse().map_err(|_| StatusCode::UNAUTHORIZED)?;
    let workspace_id: Uuid = c
        .workspace_id
        .parse()
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    req.extensions_mut().insert(AuthUser {
        user_id,
        workspace_id,
        role: c.role.clone(),
    });
    req.extensions_mut()
        .insert(WorkspaceContext::from_role(user_id, workspace_id, &c.role));
    Ok(next.run(req).await)
}
