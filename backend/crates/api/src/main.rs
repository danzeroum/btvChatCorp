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
    // Carrega .env se existir
    dotenvy::dotenv().ok();

    // Tracing
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "api=debug,info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Banco de dados
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL obrigatório");

    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    tracing::info!("Banco conectado. Rodando migrations...");
    sqlx::migrate!("../migrations").run(&db).await?;
    tracing::info!("Migrations OK");

    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".into());
    let ollama_model = std::env::var("OLLAMA_MODEL")
        .unwrap_or_else(|_| "llama3.2:3b".into());
    let jwt_secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET obrigatório");

    let state = AppState {
        db,
        ollama_url,
        ollama_model,
        jwt_secret,
    };

    let app = build_router(state);

    let addr: SocketAddr = std::env::var("LISTEN_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".into())
        .parse()?;

    tracing::info!("Servidor iniciado em http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn build_router(state: AppState) -> Router {
    use axum::routing::get;

    Router::new()
        .route("/health", get(|| async { axum::Json(serde_json::json!({ "status": "ok" })) }))
        .nest("/api/v1", routes::v1_routes())
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
