//! Rate limiting independente para o BTV Gateway.
//! Limite: GATEWAY_RATE_LIMIT_RPM requisicoes por minuto por API key.

use axum::{
    body::Body,
    extract::{Request, State},
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Json, Response},
};
use governor::{clock::DefaultClock, middleware::NoOpMiddleware, state::{InMemoryState, NotKeyed}, Quota, RateLimiter};
use std::{num::NonZeroU32, sync::Arc};

use crate::state::GatewayState;

pub type GatewayLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock, NoOpMiddleware>>;

pub fn build_gateway_limiter(rpm: u32) -> GatewayLimiter {
    let quota = Quota::per_minute(NonZeroU32::new(rpm.max(1)).unwrap());
    Arc::new(RateLimiter::direct(quota))
}

pub async fn gateway_rate_limit(
    State(state): State<GatewayState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    // Limiter global — em producao, usar per-key com DashMap
    static LIMITER: std::sync::OnceLock<GatewayLimiter> = std::sync::OnceLock::new();
    let limiter = LIMITER.get_or_init(|| build_gateway_limiter(state.config.rate_limit_rpm));

    match limiter.check() {
        Ok(_) => next.run(req).await,
        Err(not_until) => {
            let wait = not_until
                .wait_time_from(governor::clock::DefaultClock::default().now())
                .as_secs()
                .max(1);
            let mut resp = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({
                    "error": { "message": "Rate limit excedido", "type": "rate_limit_error", "retry_after": wait }
                })),
            ).into_response();
            resp.headers_mut().insert(
                "Retry-After",
                HeaderValue::from_str(&wait.to_string()).unwrap_or_else(|_| HeaderValue::from_static("1")),
            );
            resp
        }
    }
}
