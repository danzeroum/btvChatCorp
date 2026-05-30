use std::env;

use axum::http::{header, HeaderValue, Method};
use axum::routing::get;
use axum::{Json, Router};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod errors;
mod extractors;
mod middleware;
mod models;
mod rag;
mod rag_test;
mod routes;
mod security;
mod state;
mod test_helpers;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("api=debug".parse()?)
                .add_directive("tower_http=info".parse()?),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL obrigatorio");
    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    sqlx::migrate!("../../migrations").run(&db).await?;
    tracing::info!("Migrations OK");

    let ollama_url =
        env::var("OLLAMA_URL").unwrap_or_else(|_| "https://api.buildtovalue.cloud".into());
    let ollama_model = env::var("OLLAMA_MODEL").unwrap_or_else(|_| "mistral:latest".into());
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET obrigatorio");
    let api_key_hmac_secret =
        env::var("API_KEY_HMAC_SECRET").expect("API_KEY_HMAC_SECRET obrigatorio");
    let ollama_auth = match env::var("OLLAMA_AUTH_USER").ok() {
        Some(u) => {
            let p = env::var("OLLAMA_AUTH_PASS").unwrap_or_default();
            Some(format!("{}:{}", u, p))
        }
        None => None,
    };

    let qdrant_url = env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".into());
    let embedding_url =
        env::var("EMBEDDING_URL").unwrap_or_else(|_| "http://localhost:8001".into());

    tracing::info!(
        "LLM={} | Qdrant={} | Embedding={}",
        ollama_url,
        qdrant_url,
        embedding_url
    );

    let state = AppState {
        db,
        ollama_url,
        ollama_model,
        ollama_auth,
        jwt_secret,
        api_key_hmac_secret,
        qdrant_url,
        embedding_url,
    };

    // Origens permitidas vêm de ALLOWED_ORIGINS (CSV); default: dev local Angular.
    let allowed_origins: Vec<HeaderValue> = env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:4200".into())
        .split(',')
        .filter_map(|s| s.trim().parse::<HeaderValue>().ok())
        .collect();
    tracing::info!("CORS allowed origins: {:?}", allowed_origins);

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(true);

    let app = Router::new()
        .route(
            "/health",
            get(async || Json(serde_json::json!({ "status": "ok" }))),
        )
        .nest("/api/v1", routes::v1_routes(state.clone()))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:3000";
    tracing::info!("API escutando em {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
