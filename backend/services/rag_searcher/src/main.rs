use axum::{routing::get, routing::post, Router, Json};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
}

#[derive(Deserialize)]
struct SearchRequest {
    workspace_id: String,
    query: String,
    top_k: Option<usize>,
}

#[derive(Serialize)]
struct SearchResponse {
    chunks: Vec<Chunk>,
}

#[derive(Serialize)]
struct Chunk {
    id: String,
    text: String,
    score: f32,
    document_name: String,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "rag-searcher".to_string(),
    })
}

async fn search(Json(_payload): Json<SearchRequest>) -> Json<SearchResponse> {
    // TODO: implementar busca vetorial no Qdrant
    Json(SearchResponse { chunks: vec![] })
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = Router::new()
        .route("/health", get(health))
        .route("/search", post(search));

    let addr = SocketAddr::from(([0, 0, 0, 0], 9000));
    tracing::info!("RAG Searcher ouvindo em {}", addr);
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
