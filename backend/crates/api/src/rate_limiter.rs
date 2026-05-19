//! Rate limiting middleware usando governor (token-bucket algorithm).
//!
//! Limites por rota (configuráveis via env):
//!   RATE_LIMIT_CHAT_PER_MIN   default: 100
//!   RATE_LIMIT_TRAIN_PER_MIN  default: 20
//!   RATE_LIMIT_DOCS_PER_MIN   default: 1000

use std::{
    num::NonZeroU32,
    sync::Arc,
    time::Duration,
};

use axum::{
    body::Body,
    extract::Request,
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use governor::{
    clock::DefaultClock,
    middleware::NoOpMiddleware,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};

pub type SharedLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock, NoOpMiddleware>>;

/// Cria um RateLimiter com `rpm` requisições por minuto.
pub fn build_limiter(rpm: u32) -> SharedLimiter {
    let quota = Quota::per_minute(
        NonZeroU32::new(rpm.max(1)).expect("rpm deve ser > 0"),
    );
    Arc::new(RateLimiter::direct(quota))
}

/// Lê `RATE_LIMIT_CHAT_PER_MIN` do ambiente (default: 100).
pub fn chat_rpm() -> u32 {
    std::env::var("RATE_LIMIT_CHAT_PER_MIN")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(100)
}

/// Lê `RATE_LIMIT_TRAIN_PER_MIN` do ambiente (default: 20).
pub fn train_rpm() -> u32 {
    std::env::var("RATE_LIMIT_TRAIN_PER_MIN")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20)
}

/// Lê `RATE_LIMIT_DOCS_PER_MIN` do ambiente (default: 1000).
pub fn docs_rpm() -> u32 {
    std::env::var("RATE_LIMIT_DOCS_PER_MIN")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1000)
}

/// Middleware Axum: verifica o limiter e retorna 429 com `Retry-After` se esgotado.
pub async fn rate_limit_middleware(
    axum::extract::State(limiter): axum::extract::State<SharedLimiter>,
    req: Request<Body>,
    next: Next,
) -> Response {
    match limiter.check() {
        Ok(_) => next.run(req).await,
        Err(not_until) => {
            let wait_secs = not_until
                .wait_time_from(governor::clock::DefaultClock::default().now())
                .as_secs()
                .max(1);

            let retry_after = HeaderValue::from_str(&wait_secs.to_string())
                .unwrap_or_else(|_| HeaderValue::from_static("1"));

            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                axum::Json(serde_json::json!({
                    "error": "rate_limit_exceeded",
                    "message": "Muitas requisicoes. Tente novamente em breve.",
                    "retry_after_seconds": wait_secs
                })),
            )
                .into_response();

            response
                .headers_mut()
                .insert("Retry-After", retry_after);

            response
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limiter_permite_requisicoes_dentro_do_limite() {
        let limiter = build_limiter(60);
        // Deve permitir a primeira requisição
        assert!(limiter.check().is_ok());
    }

    #[test]
    fn limiter_bloqueia_apos_burst() {
        // Quota mínima: 1 por minuto
        let limiter = build_limiter(1);
        // Primeira deve passar
        assert!(limiter.check().is_ok());
        // Segunda deve ser bloqueada (burst esgotado)
        assert!(limiter.check().is_err());
    }

    #[test]
    fn chat_rpm_default() {
        // Sem variável de ambiente, deve retornar 100
        std::env::remove_var("RATE_LIMIT_CHAT_PER_MIN");
        assert_eq!(chat_rpm(), 100);
    }

    #[test]
    fn train_rpm_default() {
        std::env::remove_var("RATE_LIMIT_TRAIN_PER_MIN");
        assert_eq!(train_rpm(), 20);
    }

    #[test]
    fn docs_rpm_default() {
        std::env::remove_var("RATE_LIMIT_DOCS_PER_MIN");
        assert_eq!(docs_rpm(), 1000);
    }
}
