pub mod auth;
pub mod chats;
pub mod documents;
pub mod projects;
pub mod training;

#[cfg(test)]
mod chats_test;
#[cfg(test)]
mod documents_test;
#[cfg(test)]
mod training_test;

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::middleware::auth::require_auth;
use crate::models::chat::{Chat, CreateChatDto, FeedbackDto, Message, SendMessageDto};
use crate::models::document::Document;
use crate::models::project::{CreateProjectDto, Project, UpdateProjectDto};
use crate::routes::auth::{AuthResponse, LoginDto, RegisterDto};
use crate::routes::documents::{LinkDto, UploadForm};
use crate::routes::training::{
    QueueQuery, StartBatchDto, TrainingBatch, TrainingDocument, TrainingInteraction,
};
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        auth::register,
        auth::login,
        chats::list,
        chats::create,
        chats::get_one,
        chats::delete,
        chats::list_messages,
        chats::send_message,
        chats::feedback,
        documents::list,
        documents::upload,
        documents::get_one,
        documents::remove,
        documents::list_for_project,
        documents::link_to_project,
        documents::unlink_from_project,
        projects::list,
        projects::create,
        projects::get_one,
        projects::update,
        projects::remove,
        projects::stats,
        projects::list_instructions,
        projects::create_instruction,
        projects::update_instruction,
        projects::delete_instruction,
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
            Chat, CreateChatDto, SendMessageDto, FeedbackDto, Message,
            Document, LinkDto, UploadForm,
            Project, CreateProjectDto, UpdateProjectDto,
            TrainingInteraction, TrainingBatch, TrainingDocument,
            QueueQuery, StartBatchDto,
        )
    ),
    tags(
        (name = "auth", description = "Autenticacao"),
        (name = "chats", description = "Chats e mensagens"),
        (name = "documents", description = "Documentos e RAG"),
        (name = "projects", description = "Projetos"),
        (name = "training", description = "Fine-tuning e curadoria"),
    )
)]
struct ApiDoc;

pub fn docs_router() -> Router<AppState> {
    Router::new().merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
}

pub fn v1_routes(state: AppState) -> Router<AppState> {
    Router::new()
        .merge(auth::routes())
        .merge(chats::routes())
        .merge(documents::routes())
        .merge(projects::routes())
        .merge(training::routes())
        .merge(docs_router())
        .route_layer(axum::middleware::from_fn_with_state(
            state,
            require_auth,
        ))
}
