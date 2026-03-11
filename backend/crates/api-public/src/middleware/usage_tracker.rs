use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};

use crate::models::api_key::ApiKeyContext;

/// Middleware que contabiliza tokens e requests por API key.
/// Persiste o uso de forma não-bloqueante para não adicionar latência.
pub async fn usage_tracker(
    request: Request,
    next: Next,
) -> Response {
    // Captura contexto da API key (injetado pelo api_key_auth middleware)
    let ctx = request.extensions().get::<ApiKeyContext>().cloned();
    let path = request.uri().path().to_string();

    let response = next.run(request).await;

    // Registra uso de forma assíncrona e não-bloqueante
    if let Some(ctx) = ctx {
        tokio::spawn(async move {
            // TODO: incrementar contadores no banco ou Redis
            // app.db.execute("UPDATE api_key_usage SET requests = requests + 1 ...").await;
            tracing::debug!(
                key_id = %ctx.key_id,
                workspace_id = %ctx.workspace_id,
                path = %path,
                "USAGE_TRACKED"
            );
        });
    }

    response
}
