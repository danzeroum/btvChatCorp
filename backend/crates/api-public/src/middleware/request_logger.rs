use axum::{
    body::Body,
    extract::Request,
    middleware::Next,
    response::Response,
};
use std::time::Instant;

/// Middleware que loga cada request da API pública:
/// método, path, status, latência e API key prefix.
pub async fn request_logger(
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let start = Instant::now();

    // Captura prefix da API key para log (nunca loga a key completa)
    let key_prefix = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|k| k.chars().take(12).collect::<String>())
        .unwrap_or_else(|| "anonymous".into());

    let response = next.run(request).await;
    let elapsed = start.elapsed().as_millis();
    let status = response.status().as_u16();

    tracing::info!(
        method = %method,
        path = %path,
        status = status,
        latency_ms = elapsed,
        key_prefix = %key_prefix,
        "API_PUBLIC_REQUEST"
    );

    response
}
