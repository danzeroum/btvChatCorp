use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};

/// Contabiliza requisições por API key para billing/métricas.
/// A contagem de tokens é feita dentro do handler de chat.
pub async fn usage_tracker(request: Request, next: Next) -> Response {
    // Loga a rota acessada (contagem de tokens é feita no chat handler)
    let path = request.uri().path().to_string();
    tracing::debug!(path = %path, "usage_tracker: request");
    next.run(request).await
}
