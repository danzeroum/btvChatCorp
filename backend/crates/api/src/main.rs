use std::net::SocketAddr;

use axum::Router;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod errors;
mod middleware;
mod models;
mod routes;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "api=debug,info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL obrigatorio");

    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    tracing::info!("Banco conectado. Rodando migrations...");
    sqlx::migrate!("../../migrations").run(&db).await?;
    tracing::info!("Migrations OK");

    let ollama_url   = std::env::var("OLLAMA_URL").unwrap_or_else(|_| "https://api.buildtovalue.cloud".into());
    let ollama_model = std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "mistral:latest".into());
    let jwt_secret   = std::env::var("JWT_SECRET").expect("JWT_SECRET obrigatorio");

    // Basic auth para LLM externa: combina OLLAMA_AUTH_USER e OLLAMA_AUTH_PASS
    let ollama_auth = match (
        std::env::var("OLLAMA_AUTH_USER").ok(),
        std::env::var("OLLAMA_AUTH_PASS").ok(),
    ) {
        (Some(u), Some(p)) if !u.is_empty() => Some(format!("{u}:{p}")),
        _ => None,
    };

    tracing::info!("LLM: {} | model: {} | auth: {}", ollama_url, ollama_model, ollama_auth.is_some());

    let state = AppState { db, ollama_url, ollama_model, ollama_auth, jwt_secret };

    let app = Router::new()
        .route("/health", axum::routing::get(|| async {
            axum::Json(serde_json::json!({ "status": "ok" }))
        }))
        .nest("/api/v1", routes::v1_routes(state.clone()))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = std::env::var("LISTEN_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".into())
        .parse()?;

    tracing::info!("Servidor em http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
