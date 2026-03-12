use axum::{
    extract::State,
    http::{header, StatusCode},
    middleware::Next,
    request::Request,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub:          String,
    pub workspace_id: String,
    pub role:         String,
    pub exp:          usize,
}

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

    let c = token_data.claims;
    req.extensions_mut().insert(AuthUser {
        user_id:      c.sub.parse().map_err(|_| StatusCode::UNAUTHORIZED)?,
        workspace_id: c.workspace_id.parse().map_err(|_| StatusCode::UNAUTHORIZED)?,
        role:         c.role,
    });
    Ok(next.run(req).await)
}
