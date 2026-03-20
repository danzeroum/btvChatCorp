pub mod auth;
pub mod branding;
pub mod chats;
pub mod documents;
pub mod onboarding;
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
use crate::routes::branding::BrandingConfigResponse;
use crate::routes::documents::{LinkDto, UploadForm};
use crate::routes::onboarding::{AcceptInviteDto, AdvanceStepDto, ChecklistResponse, InviteDto};
use crate::routes::training::{
    QueueQuery, StartBatchDto, TrainingBatch, TrainingDocument, TrainingInteraction,
};
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        auth::register,
        auth::login,
        branding::get_theme_css,
        branding::get_config,
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
        projects::list,
        projects::create,
        projects::get_one,
        projects::update,
        projects::remove,
        projects::stats,
        training::list_queue,
        training::approve,
        training::reject,
        training::list_batches,
        training::start_batch,
        training::get_batch,
        training::poll_batch_status,
        training::list_documents,
        onboarding::advance_step,
        onboarding::get_checklist,
        onboarding::dismiss_checklist,
        onboarding::create_invite,
        onboarding::accept_invite,
    ),
    components(
        schemas(
            RegisterDto, LoginDto, AuthResponse,
            BrandingConfigResponse,
            Chat, CreateChatDto, SendMessageDto, FeedbackDto, Message,
            Document, LinkDto, UploadForm,
            Project, CreateProjectDto, UpdateProjectDto,
            TrainingInteraction, TrainingBatch, TrainingDocument,
            QueueQuery, StartBatchDto,
            AdvanceStepDto, ChecklistResponse, InviteDto, AcceptInviteDto,
        )
    ),
    tags(
        (name = "auth", description = "Autenticacao"),
        (name = "branding", description = "Tema e white-label"),
        (name = "chats", description = "Chats e mensagens"),
        (name = "documents", description = "Documentos e RAG"),
        (name = "onboarding", description = "Wizard e checklist de onboarding"),
        (name = "projects", description = "Projetos"),
        (name = "training", description = "Fine-tuning e curadoria"),
    )
)]
struct ApiDoc;

pub fn docs_router() -> Router<AppState> {
    Router::new().merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
}

pub fn v1_routes(state: AppState) -> Router<AppState> {
    // Rotas protegidas por JWT
    let protected = Router::new()
        .merge(chats::routes())
        .merge(documents::routes())
        .merge(projects::routes())
        .merge(training::routes())
        .merge(onboarding::protected_routes())
        .route_layer(axum::middleware::from_fn_with_state(state, require_auth));

    // Rotas publicas (sem JWT)
    Router::new()
        .merge(auth::routes())
        .merge(branding::routes()) // theme.css e config.json sao publicos
        .merge(onboarding::public_routes()) // accept_invite e publico
        .merge(protected)
        .merge(docs_router())
}
