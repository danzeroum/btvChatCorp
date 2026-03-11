pub mod errors;
pub mod middleware;
pub mod routes;
pub mod state;

pub use state::AppState;

use axum::{
    Router,
    middleware as axum_mw,
};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
    compression::CompressionLayer,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    middleware::{api_key_auth::api_key_auth, request_logger::request_logger, usage_tracker::usage_tracker},
    routes::{chat, documents, search, feedback, webhooks, usage},
};

/// Constrói o router completo da API pública com todas as rotas e middlewares
pub fn build_router(state: AppState) -> Router {
    // Rotas versionadas v1
    let v1 = Router::new()
        // Chat (OpenAI-compat)
        .route("/chat/completions",        axum::routing::post(chat::create_completion))
        .route("/chat/completions/stream", axum::routing::post(chat::create_streaming_completion))
        // Documents
        .route("/documents",              axum::routing::get(documents::list_documents)
                                             .post(documents::upload_document))
        .route("/documents/:id",          axum::routing::get(documents::get_document)
                                             .delete(documents::delete_document))
        .route("/documents/:id/status",   axum::routing::get(documents::get_processing_status))
        // Semantic search
        .route("/search",                 axum::routing::post(search::semantic_search))
        // Feedback / training
        .route("/feedback",               axum::routing::post(feedback::submit_feedback))
        .route("/training/status",        axum::routing::get(feedback::get_training_status))
        // Webhooks
        .route("/webhooks",               axum::routing::get(webhooks::list_webhooks)
                                             .post(webhooks::create_webhook))
        .route("/webhooks/:id",           axum::routing::get(webhooks::get_webhook)
                                             .put(webhooks::update_webhook)
                                             .delete(webhooks::delete_webhook))
        .route("/webhooks/:id/test",      axum::routing::post(webhooks::test_webhook))
        .route("/webhooks/:id/deliveries",axum::routing::get(webhooks::list_deliveries))
        // Usage
        .route("/usage",                  axum::routing::get(usage::get_usage))
        .route("/usage/breakdown",        axum::routing::get(usage::get_breakdown))
        // Middlewares (ordem importa: de fora para dentro)
        .layer(axum_mw::from_fn_with_state(state.clone(), api_key_auth))
        .layer(axum_mw::from_fn(usage_tracker))
        .layer(axum_mw::from_fn(request_logger));

    // OpenAPI spec + Swagger UI
    #[derive(OpenApi)]
    #[openapi(
        info(
            title = "BTV Chat Corp — AI Platform API",
            version = "1.0.0",
            description = "API p\u00fablica para integra\u00e7\u00e3o com a plataforma de IA privada.",
        ),
        tags(
            (name = "Chat",      description = "Enviar mensagens e receber respostas da IA"),
            (name = "Documents", description = "Gerenciar documentos na base de conhecimento"),
            (name = "Search",    description = "Busca sem\u00e2ntica na base de documentos"),
            (name = "Training",  description = "Enviar feedback para treinamento cont\u00ednuo"),
            (name = "Webhooks",  description = "Gerenciar webhooks para eventos da plataforma"),
            (name = "Usage",     description = "M\u00e9tricas de uso e billing"),
        ),
        security(
            ("api_key" = [])
        )
    )]
    struct ApiDoc;

    Router::new()
        // Swagger UI em /api-docs
        .merge(SwaggerUi::new("/api-docs").url("/api/openapi.json", ApiDoc::openapi()))
        // Rotas versionadas
        .nest("/api/v1", v1)
        // CORS — permite o frontend Angular
        .layer(CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any))
        // Compresão gzip
        .layer(CompressionLayer::new())
        // Tracing HTTP
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
