use axum::{
    extract::{Extension, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use rag_searcher::SearchFilters;
use crate::{
    errors::{error_response, ApiError},
    middleware::api_key_auth::ApiKeyContext,
    state::AppState,
};

#[derive(Debug, Deserialize, ToSchema)]
pub struct SearchRequest {
    pub query: String,
    pub top_k: Option<usize>,
    pub document_id: Option<String>,
    pub chunk_type: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SearchResponse {
    pub results: Vec<SearchResultItem>,
    pub total_candidates: usize,
    pub search_time_ms: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SearchResultItem {
    pub document_id: String,
    pub section: Option<String>,
    pub content: String,
    pub relevance_score: f32,
}

/// POST /api/v1/search
#[utoipa::path(
    post,
    path = "/api/v1/search",
    tag = "Search",
    request_body = SearchRequest,
    responses((status = 200, description = "Resultados da busca semântica", body = SearchResponse)),
    security(("api_key" = []))
)]
pub async fn semantic_search(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Json(req): Json<SearchRequest>,
) -> Result<Json<SearchResponse>, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("search", "read") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions",
            "API key does not have search:read permission"));
    }

    let filters = if req.document_id.is_some() || req.chunk_type.is_some() {
        Some(SearchFilters {
            document_id: req.document_id.clone(),
            chunk_type: req.chunk_type.clone(),
        })
    } else {
        None
    };

    let result = app.rag
        .search(&req.query, ctx.workspace_id, req.top_k.unwrap_or(10), filters, None)
        .await
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "search_error", e.to_string()))?;

    Ok(Json(SearchResponse {
        results: result.chunks.iter().map(|c| SearchResultItem {
            document_id: c.document_id.clone(),
            section: c.section_title.clone(),
            content: c.content.clone(),
            relevance_score: c.rerank_score,
        }).collect(),
        total_candidates: result.total_candidates,
        search_time_ms: result.search_time_ms,
    }))
}
