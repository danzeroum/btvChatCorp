pub mod auth;
pub mod chats;
pub mod documents;
pub mod projects;

use axum::Router;
use crate::state::AppState;
use crate::middleware::auth::require_auth;

pub fn v1_routes(state: AppState) -> Router<AppState> {
    let public = auth::routes();

    // Aplica middleware de auth nas rotas protegidas
    // usando route_layer para nao conflitar com o tipo do Router<AppState>
    let protected = Router::new()
        .merge(projects::routes())
        .merge(chats::routes())
        .merge(documents::routes())
        .route_layer(axum::middleware::from_fn_with_state(state, require_auth));

    Router::new().merge(public).merge(protected)
}
