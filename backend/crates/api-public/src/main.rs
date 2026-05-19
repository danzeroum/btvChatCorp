//! BTV Gateway — servidor HTTP independente OpenAI-compatible.
//!
//! Rotas expostas:
//!   POST /v1/chat/completions   — inferencia (OpenAI-compatible)
//!   POST /v1/embeddings         — vetorizacao (OpenAI-compatible)
//!   GET  /v1/models             — lista modelos disponiveis
//!   GET  /health                — healthcheck
//!   GET  /docs                  — Swagger UI

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod auth;
mod config;
mod handlers;
mod models;
mod rate_limit;
mod state;

use config::GatewayConfig;
use state::GatewayState;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "BTV Gateway",
        version = "0.1.0",
        description = "API publica do BTV Gateway — compativel com OpenAI SDK.",
        contact(name = "BuildToValue", url = "https://buildtovalue.cloud"),
        license(name = "Proprietary")
    ),
    paths(
        handlers::chat::completions,
        handlers::embeddings::embed,
        handlers::models::list_models,
    ),
    components(schemas(
        models::ChatCompletionRequest,
        models::ChatCompletionResponse,
        models::ChatMessage,
        models::EmbeddingRequest,
        models::EmbeddingResponse,
        models::Model,
        models::ModelsResponse,
    )),
    tags(
        (name = "chat", description = "Inferencia de chat"),
        (name = "embeddings", description = "Vetorizacao de texto"),
        (name = "models", description = "Modelos disponiveis"),
    )
)]
pub struct ApiDoc;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let cfg = GatewayConfig::from_env();
    let state = GatewayState::new(&cfg).await;

    // CORS: api-public aceita qualquer origem (clientes externos)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // OpenAI-compatible endpoints
        .route("/v1/chat/completions", post(handlers::chat::completions))
        .route("/v1/embeddings", post(handlers::embeddings::embed))
        .route("/v1/models", get(handlers::models::list_models))
        // Autenticacao via API key (Bearer token)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::api_key_middleware,
        ))
        // Rate limiting independente da API interna
        .layer(middleware::from_fn_with_state(
            state.clone(),
            rate_limit::gateway_rate_limit,
        ))
        .route("/health", get(handlers::health::health))
        .merge(SwaggerUi::new("/docs").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .layer(cors)
        .with_state(state);

    let addr: SocketAddr = cfg.bind_addr.parse().expect("endereco invalido");
    tracing::info!("BTV Gateway ouvindo em {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
