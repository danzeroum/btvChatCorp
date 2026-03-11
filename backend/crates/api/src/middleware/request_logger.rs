use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use std::time::Instant;

/// Loga método, path, status e latency de cada request
pub async fn request_logger(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let start = Instant::now();

    let response = next.run(request).await;

    let status = response.status().as_u16();
    let elapsed = start.elapsed().as_millis();

    tracing::info!(
        method = %method,
        path = %path,
        status = status,
        elapsed_ms = elapsed,
        "HTTP request"
    );

    response
}
