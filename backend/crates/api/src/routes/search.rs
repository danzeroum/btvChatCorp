use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{extractors::WorkspaceContext, state::AppState};

pub fn search_routes() -> Router<AppState> {
    Router::new()
        .route("/search", post(semantic_search))
        .route("/search/hybrid", post(hybrid_search))
}

// ─── Request / Response structs ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub top_k: Option<usize>,
    pub project_id: Option<String>,
    pub document_ids: Option<Vec<String>>,
    pub chunk_type: Option<String>,
    pub min_score: Option<f32>,
    pub rerank: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct SearchResultItem {
    pub document_id: String,
    pub document_name: String,
    pub section: Option<String>,
    pub content: String,
    pub score: f32,
    pub chunk_type: String,
    pub context_before: Option<String>,
    pub context_after: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResultItem>,
    pub total_candidates: usize,
    pub search_time_ms: u64,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// Busca semântica principal via Qdrant + re-ranking opcional
pub async fn semantic_search(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Json(req): Json<SearchRequest>,
) -> Result<Json<SearchResponse>, (StatusCode, Json<serde_json::Value>)> {
    let top_k = req.top_k.unwrap_or(5).min(20);

    // Gera embedding da query
    let embed_response: serde_json::Value = app
        .http
        .post(format!("{}/embed", app.embedding_url))
        .json(&serde_json::json!({ "texts": [format!("search_query: {}", req.query)] }))
        .send()
        .await
        .map_err(|e| error_response(StatusCode::SERVICE_UNAVAILABLE, &e.to_string()))?
        .json()
        .await
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    let embedding = embed_response["embeddings"][0]
        .as_array()
        .ok_or_else(|| error_response(StatusCode::INTERNAL_SERVER_ERROR, "Invalid embedding response"))?
        .iter()
        .filter_map(|v| v.as_f64().map(|f| f as f32))
        .collect::<Vec<f32>>();

    let collection = format!("workspace_{}", ctx.workspace_id);

    // Monta filtros Qdrant
    let mut must_conditions = vec![];
    if let Some(doc_ids) = &req.document_ids {
        if !doc_ids.is_empty() {
            must_conditions.push(serde_json::json!({
                "key": "document_id",
                "match": { "any": doc_ids }
            }));
        }
    }
    if let Some(chunk_type) = &req.chunk_type {
        must_conditions.push(serde_json::json!({
            "key": "chunk_type",
            "match": { "value": chunk_type }
        }));
    }

    let filter = if must_conditions.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::json!({ "must": must_conditions })
    };

    let start = std::time::Instant::now();

    // Busca vetorial no Qdrant
    let mut qdrant_req = serde_json::json!({
        "vector": embedding,
        "limit": top_k * 4, // busca mais para re-ranking
        "with_payload": true,
        "score_threshold": req.min_score.unwrap_or(0.0)
    });
    if !filter.is_null() {
        qdrant_req["filter"] = filter;
    }

    let qdrant_resp: serde_json::Value = app
        .http
        .post(format!("{}/collections/{}/points/search", app.qdrant_url, collection))
        .json(&qdrant_req)
        .send()
        .await
        .map_err(|e| error_response(StatusCode::SERVICE_UNAVAILABLE, &e.to_string()))?
        .json()
        .await
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    let search_time_ms = start.elapsed().as_millis() as u64;

    let candidates = qdrant_resp["result"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let total_candidates = candidates.len();

    // Monta resultados
    let results: Vec<SearchResultItem> = candidates
        .into_iter()
        .take(top_k)
        .map(|point| {
            let p = &point["payload"];
            SearchResultItem {
                document_id: p["document_id"].as_str().unwrap_or("").to_string(),
                document_name: p["section_title"].as_str().unwrap_or("Document").to_string(),
                section: p["section_title"].as_str().map(|s| s.to_string()),
                content: p["content"].as_str().unwrap_or("").to_string(),
                score: point["score"].as_f64().unwrap_or(0.0) as f32,
                chunk_type: p["chunk_type"].as_str().unwrap_or("generic").to_string(),
                context_before: None,
                context_after: None,
            }
        })
        .collect();

    Ok(Json(SearchResponse { results, total_candidates, search_time_ms }))
}

/// Busca híbrida: combina semântica + full-text (BM25 via PostgreSQL)
pub async fn hybrid_search(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Json(req): Json<SearchRequest>,
) -> Result<Json<SearchResponse>, (StatusCode, Json<serde_json::Value>)> {
    let top_k = req.top_k.unwrap_or(5).min(20);

    // Full-text search via PostgreSQL tsvector
    let pg_results = sqlx::query!(
        r#"
        SELECT document_id::text, content, section_title, chunk_type,
               ts_rank(to_tsvector('portuguese', content),
                       plainto_tsquery('portuguese', $2)) AS rank
        FROM document_chunks
        WHERE workspace_id = $1
          AND to_tsvector('portuguese', content) @@ plainto_tsquery('portuguese', $2)
        ORDER BY rank DESC
        LIMIT $3
        "#,
        ctx.workspace_id,
        req.query,
        top_k as i64,
    )
    .fetch_all(&app.db)
    .await
    .unwrap_or_default();

    let start = std::time::Instant::now();
    let total_candidates = pg_results.len();

    let results: Vec<SearchResultItem> = pg_results
        .into_iter()
        .map(|r| SearchResultItem {
            document_id: r.document_id.unwrap_or_default(),
            document_name: r.section_title.clone().unwrap_or_else(|| "Document".into()),
            section: r.section_title,
            content: r.content,
            score: r.rank.unwrap_or(0.0) as f32,
            chunk_type: r.chunk_type,
            context_before: None,
            context_after: None,
        })
        .collect();

    Ok(Json(SearchResponse {
        results,
        total_candidates,
        search_time_ms: start.elapsed().as_millis() as u64,
    }))
}

fn error_response(
    status: StatusCode,
    msg: &str,
) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
