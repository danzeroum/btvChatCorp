pub mod errors;
pub mod middleware;
pub mod models;
pub mod openapi;
pub mod routes;

use axum::{
    middleware as axum_middleware,
    Router,
};

use crate::{
    middleware::{
        api_key_auth::api_key_auth,
        rate_limiter::rate_limit_layer,
        request_logger::request_logger,
        usage_tracker::usage_tracker,
    },
};

// Re-exporta o AppState do crate api para reaproveitamento
use crate_api::state::AppState;

/// Monta o Router da API Pública com todos os middlewares e rotas versionadas
pub fn public_api_router(state: AppState) -> Router {
    let v1 = api_v1_routes();

    Router::new()
        // Swagger UI
        .merge(openapi::swagger_ui())
        // Rotas versionadas
        .nest("/api/v1", v1)
        .with_state(state)
}

fn api_v1_routes() -> Router<AppState> {
    Router::new()
        // Chat (compatível com formato OpenAI)
        .merge(routes::chat::chat_routes())
        // Documentos
        .merge(routes::documents::document_routes())
        // Projetos
        .merge(routes::projects::project_routes())
        // Busca semântica
        .merge(routes::search::search_routes())
        // Feedback / treinamento
        .merge(routes::training::training_routes())
        // Webhooks
        .merge(routes::webhooks::webhook_routes())
        // Métricas de uso
        .merge(routes::usage::usage_routes())
        // Middleware stack (aplicado em ordem reversa)
        .layer(axum_middleware::from_fn(request_logger))
        .layer(axum_middleware::from_fn(usage_tracker))
        .layer(rate_limit_layer())
        // Autenticação por API key (deve ser o mais externo)
        // .layer(axum_middleware::from_fn_with_state(state.clone(), api_key_auth))
}
