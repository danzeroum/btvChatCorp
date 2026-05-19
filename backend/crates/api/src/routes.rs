use axum::{
    routing::{get, post},
    Router,
};

use crate::{
    handlers::partner,
    state::AppState,
};

/// Monta todas as rotas sob /api/v1
pub fn v1_routes(state: AppState) -> Router<AppState> {
    Router::new()
        // ---- Auth ----
        .route("/auth/login",   post(crate::middleware::auth_placeholder))
        .route("/auth/refresh", post(crate::middleware::refresh_placeholder))
        .route("/auth/me",      get(crate::middleware::me_placeholder))

        // ---- Programa de Parceiros ----
        .route("/partner/signup",     post(partner::signup))
        .route("/partner/workspaces", get(partner::list_workspaces)
                                        .post(partner::create_workspace))

        // ---- Gateway internal proxy (usado pelo btv-gateway) ----
        .route("/gateway/chat", post(crate::middleware::gateway_chat_placeholder))

        .with_state(state)
}
