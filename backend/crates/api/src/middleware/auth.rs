use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
    Extension,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub:          String,   // user_id
    pub workspace_id: String,
    pub role:         String,
    pub exp:          usize,
}

/// Extractor injetado em handlers protegidos
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id:      Uuid,
    pub workspace_id: Uuid,
    pub role:         String,
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let claims = token_data.claims;
    let auth_user = AuthUser {
        user_id:      claims.sub.parse().map_err(|_| StatusCode::UNAUTHORIZED)?,
        workspace_id: claims.workspace_id.parse().map_err(|_| StatusCode::UNAUTHORIZED)?,
        role:         claims.role,
    };

    req.extensions_mut().insert(auth_user);
    Ok(next.run(req).await)
}
