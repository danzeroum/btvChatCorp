//! Rate limiting in-memory por API key.
//!
//! Cada API key carrega seu próprio limite (`ApiKeyContext.rate_limit`, vindo do
//! banco), então usamos uma janela fixa de 60s por `key_id` em vez do
//! `governor::RateLimiter` keyed — que aplica uma única quota uniforme para todas
//! as chaves e não acomodaria limites por-chave variáveis.
//!
//! Estado em memória: não distribui entre instâncias (aceitável para MVP; o
//! plano de longo prazo é mover para um backend compartilhado).

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::models::api_key::ApiKeyContext;

const WINDOW: Duration = Duration::from_secs(60);

/// Contador (requests na janela atual, início da janela) por `key_id`.
#[derive(Clone, Default)]
pub struct RateLimiterState {
    windows: Arc<Mutex<HashMap<String, (u32, Instant)>>>,
}

impl RateLimiterState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registra uma requisição da chave e devolve `true` se está dentro do limite.
    fn check(&self, key_id: &str, limit: u32) -> bool {
        let now = Instant::now();
        let mut windows = self.windows.lock().unwrap();
        let entry = windows.entry(key_id.to_string()).or_insert((0, now));

        // Reinicia a janela se já expirou.
        if now.duration_since(entry.1) >= WINDOW {
            *entry = (0, now);
        }

        if entry.0 >= limit {
            return false;
        }
        entry.0 += 1;
        true
    }
}

/// Middleware de rate limiting. Deve rodar depois do `api_key_auth` para que o
/// `ApiKeyContext` já esteja disponível nas extensions.
pub async fn rate_limit_middleware(
    State(state): State<RateLimiterState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Some(ctx) = request.extensions().get::<ApiKeyContext>() {
        // `rate_limit == 0` significa "sem limite configurado".
        if ctx.rate_limit > 0 && !state.check(&ctx.key_id, ctx.rate_limit) {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }
    Ok(next.run(request).await)
}
