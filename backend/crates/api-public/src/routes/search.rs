//! Busca semântica da API Pública.
//!
//! Implementação nativa: autentica por API key e retorna os chunks RAG mais
//! relevantes para a query dentro do workspace. Apenas leitura — sem FK de
//! `users`, sem persistência.

use axum::{extract::State, response::Json, routing::post, Router};
use serde::{Deserialize, Serialize};

use crate::{
    errors::ApiError,
    models::api_key::{require_permission, ApiKeyContext},
};
use crate_api::rag::search_rag;
use crate_api::state::AppState;

pub fn search_routes() -> Router<AppState> {
    Router::new().route("/search", post(semantic_search))
}

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub top_k: Option<usize>,
    pub min_score: Option<f32>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub filename: String,
    pub section: String,
    pub chunk_index: i64,
    pub score: f32,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub query: String,
    pub results: Vec<SearchResult>,
}

/// POST /api/v1/search — busca semântica nos documentos do workspace.
pub async fn semantic_search(
    State(app): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<ApiKeyContext>,
    Json(req): Json<SearchRequest>,
) -> Result<Json<SearchResponse>, ApiError> {
    require_permission(&ctx, "search", "read")?;

    let chunks = search_rag(
        &app.qdrant_url,
        &app.embedding_url,
        &ctx.workspace_id.to_string(),
        &req.query,
        req.top_k.unwrap_or(5),
        req.min_score.unwrap_or(0.35),
    )
    .await
    .map_err(|e| ApiError::new("rag_error", e.to_string()))?;

    Ok(Json(SearchResponse {
        query: req.query,
        results: chunks
            .into_iter()
            .map(|c| SearchResult {
                filename: c.filename,
                section: c.section,
                chunk_index: c.chunk_index,
                score: c.score,
                content: c.content,
            })
            .collect(),
    }))
}
