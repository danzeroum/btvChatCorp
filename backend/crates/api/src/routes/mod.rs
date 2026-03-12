pub mod auth;
pub mod projects;
pub mod chats;
pub mod documents;

use axum::Router;
use axum::middleware as axum_mw;
use crate::state::AppState;
use crate::middleware::auth::require_auth;

pub fn v1_routes() -> Router<AppState> {
    Router::new()
        .merge(auth::routes())
        .merge(protected_routes())
}

fn protected_routes() -> Router<AppState> {
    Router::new()
        .merge(projects::routes())
        .merge(chats::routes())
        .merge(documents::routes())
        .layer(axum_mw::from_fn(require_auth))
}
