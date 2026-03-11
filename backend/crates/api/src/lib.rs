pub mod extractors;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod services;
pub mod state;

use axum::Router;
use state::AppState;

/// Monta o Router principal da API interna com todas as rotas registradas.
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .merge(routes::chat::chat_routes())
        .merge(routes::documents::document_routes())
        .merge(routes::projects::project_routes())
        .merge(routes::search::search_routes())
        .merge(routes::training::training_routes())
        .merge(routes::usage::usage_routes())
        .merge(routes::admin::admin_routes())
        .with_state(state)
}
