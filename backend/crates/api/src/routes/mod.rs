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
use crate::models::project::{Project, CreateProjectDto, UpdateProjectDto};
use crate::models::chat::{Chat, Message, CreateChatDto, SendMessageDto, FeedbackDto};
use crate::models::document::Document;
use crate::routes::training::{
    TrainingInteraction, TrainingBatch, TrainingDocument,
    QueueQuery, StartBatchDto,
};
use crate::routes::documents::{LinkDto, UploadForm};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "BTV Chat Corp API",
        version = "1.0.0",
        description = "API REST do BTV Chat Corp — autenticacao, chat, documentos, treinamento e admin",
        contact(name = "BTV Team", url = "https://buildtovalue.cloud"),
    ),
    paths(
        auth::register,
        auth::login,
        projects::list,
        projects::create,
        projects::get_one,
        projects::update,
        projects::remove,
        projects::stats,
        chats::list,
        chats::create,
        chats::get_one,
        chats::remove,
        chats::get_messages,
        chats::send_message,
        chats::feedback,
        documents::list,
        documents::upload,
        documents::get_one,
        documents::remove,
        documents::list_for_project,
        documents::link_to_project,
        documents::unlink_from_project,
        training::list_queue,
        training::approve,
        training::reject,
        training::list_batches,
        training::start_batch,
        training::get_batch,
        training::poll_batch_status,
        training::list_documents,
    ),
    components(
        schemas(
            RegisterDto, LoginDto, AuthResponse,
            Project, CreateProjectDto, UpdateProjectDto,
            Chat, Message, CreateChatDto, SendMessageDto, FeedbackDto,
            Document, LinkDto, UploadForm,
            TrainingInteraction, TrainingBatch, TrainingDocument,
            QueueQuery, StartBatchDto,
        )
    ),
    tags(
        (name = "Auth",      description = "Registro e autenticacao de usuarios"),
        (name = "Projects",  description = "Gerenciamento de projetos do workspace"),
        (name = "Chat",      description = "Sessoes de chat e mensagens com o LLM"),
        (name = "Documents", description = "Upload e gestao de documentos para RAG"),
        (name = "Training",  description = "Pipeline de treinamento e fine-tuning LoRA"),
        (name = "Admin",     description = "Administracao do workspace"),
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
