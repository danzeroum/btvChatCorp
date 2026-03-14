pub mod auth;
pub mod chats;
pub mod documents;
pub mod projects;
pub mod training;

#[cfg(test)]
mod documents_test;
#[cfg(test)]
mod chats_test;
#[cfg(test)]
mod training_test;

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::state::AppState;
use crate::middleware::auth::require_auth;
use crate::routes::auth::{RegisterDto, LoginDto, AuthResponse};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "BTV Chat Corp API",
        version = "1.0.0",
        description = "API REST do BTV Chat Corp — autenticacao, chat, documentos, treinamento e admin",
        contact(
            name = "BTV Team",
            url = "https://buildtovalue.cloud"
        ),
    ),
    paths(
        auth::register,
        auth::login,
    ),
    components(
        schemas(
            RegisterDto,
            LoginDto,
            AuthResponse,
        )
    ),
    tags(
        (name = "Auth",     description = "Registro e autenticacao de usuarios"),
        (name = "Chat",     description = "Sessoes e mensagens de chat"),
        (name = "Training", description = "Pipeline de treinamento e fine-tuning LoRA"),
        (name = "Admin",    description = "Administracao do workspace"),
    ),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;

struct SecurityAddon;
impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "BearerAuth",
                utoipa::openapi::security::SecurityScheme::Http(
                    utoipa::openapi::security::HttpBuilder::new()
                        .scheme(utoipa::openapi::security::HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            );
        }
    }
}

/// GET /docs        → Swagger UI
/// GET /docs/openapi.json → spec JSON (servido pelo SwaggerUi)
pub fn docs_router() -> Router<AppState> {
    Router::new().merge(
        SwaggerUi::new("/docs")
            .url("/docs/openapi.json", ApiDoc::openapi()),
    )
}

pub fn v1_routes(state: AppState) -> Router<AppState> {
    let public = auth::routes();

    let protected = Router::new()
        .merge(projects::routes())
        .merge(chats::routes())
        .merge(documents::routes())
        .merge(training::routes())
        .route_layer(axum::middleware::from_fn_with_state(state, require_auth));

    Router::new().merge(public).merge(protected)
}
