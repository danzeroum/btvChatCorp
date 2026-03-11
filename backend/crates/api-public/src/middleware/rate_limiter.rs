use axum::{
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

/// Cria o layer de rate limiting.
/// Por ora retorna um no-op layer; a integração real usa `tower_governor`.
/// TODO: integrar com governor + Redis para rate limiting distribuído.
pub fn rate_limit_layer() -> tower::layer::util::Identity {
    // tower::ServiceBuilder::new()
    //     .layer(GovernorLayer { config: Arc::new(governor_config) })
    tower::layer::util::Identity::new()
}

/// Middleware de rate limiting simples baseado em IP / API key.
/// Esta versão registra o acesso mas não bloqueia.
/// Substituir por `tower_governor` quando Redis estiver disponível.
pub async fn rate_limit_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // TODO: implementar contagem em Redis com sliding window
    Ok(next.run(request).await)
}
