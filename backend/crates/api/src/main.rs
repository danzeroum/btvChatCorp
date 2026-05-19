mod config;
mod errors;
mod extractors;
mod middleware;
mod models;
#[cfg(test)]
mod rag_test;
mod routes;
mod services;
mod state;
#[cfg(test)]
mod test_helpers;
mod rag;

use axum::routing::get;
use axum::{Json, Router};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::AppConfig;
use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Carrega e valida configuracao (panic early se faltando algo obrigatorio)
    let cfg = AppConfig::from_env();

    // 2. Logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("api=debug".parse()?)
                .add_directive("tower_http=info".parse()?),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 3. Banco de dados + migrations
    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(cfg.db_max_conn)
        .connect(&cfg.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&db).await?;
    tracing::info!("Migrations OK");

    // 4. Log do ambiente
    tracing::info!(
        "LLM={} | Qdrant={} | Embedding={}",
        cfg.ollama_url, cfg.qdrant_url, cfg.embedding_url
    );

    // 5. Estado compartilhado
    let state = AppState {
        db,
        ollama_url:    cfg.ollama_url,
        ollama_model:  cfg.ollama_model,
        ollama_auth:   cfg.ollama_auth,
        jwt_secret:    cfg.jwt_secret,
        qdrant_url:    cfg.qdrant_url,
        embedding_url: cfg.embedding_url,
    };

    // 6. Router
    let app = Router::new()
        .route("/health", get(async || Json(serde_json::json!({ "status": "ok" }))))
        .nest("/api/v1", routes::v1_routes(state.clone()))
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    tracing::info!("API escutando em {}", cfg.bind_addr);
    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
