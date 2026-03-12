pub mod auth;
pub mod chats;
pub mod documents;
pub mod projects;

use axum::{middleware as mw, Router};
use crate::{middleware::auth::require_auth, state::AppState};

pub fn v1_routes() -> Router<AppState> {
    let public = auth::routes();

    let protected = Router::new()
        .merge(projects::routes())
        .merge(chats::routes())
        .merge(documents::routes())
        .layer(mw::from_fn_with_state(AppState::placeholder(), require_auth));

    Router::new().merge(public).merge(protected)
}
