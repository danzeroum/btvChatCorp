pub mod errors;
pub mod middleware;
pub mod models;
pub mod openapi;
pub mod routes;

use axum::{middleware as axum_middleware, Router};

use crate::middleware::{
    api_key_auth::api_key_auth,
    rate_limiter::{rate_limit_middleware, RateLimiterState},
    request_logger::request_logger,
    usage_tracker::usage_tracker,
};

// Re-exporta o AppState do crate api para reaproveitamento
use crate_api::state::AppState;

/// Monta o Router da API Pública com todos os middlewares e rotas versionadas
pub fn public_api_router(state: AppState) -> Router {
    // v1 carrega o AppState; resolvemos o state aqui para obter um `Router<()>`
    // que possa ser aninhado junto da Swagger UI.
    let v1 = api_v1_routes(state.clone()).with_state(state);

    Router::new()
        // Swagger UI
        .merge(openapi::swagger_ui())
        // Rotas versionadas
        .nest("/api/v1", v1)
}

fn api_v1_routes(state: AppState) -> Router<AppState> {
    let rate_limiter = RateLimiterState::new();

    Router::new()
        // Chat completions (OpenAI-compatível, stateless)
        .merge(routes::chat::chat_routes())
        // Busca semântica
        .merge(routes::search::search_routes())
        // CRUD de webhooks
        .merge(routes::webhooks::webhook_routes())
        // Métricas de uso
        .merge(routes::usage::usage_routes())
        // Middleware stack (aplicado em ordem reversa de execução):
        .layer(axum_middleware::from_fn(request_logger))
        .layer(axum_middleware::from_fn(usage_tracker))
        // Rate limiting por API key (lê o ApiKeyContext injetado pelo auth)
        .layer(axum_middleware::from_fn_with_state(
            rate_limiter,
            rate_limit_middleware,
        ))
        // Autenticação por API key (mais externo → executa primeiro)
        .layer(axum_middleware::from_fn_with_state(state, api_key_auth))
}
