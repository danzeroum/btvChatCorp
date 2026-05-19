use axum::{
    extract::{Extension, State},
    http::StatusCode,
    Json,
};
use utoipa::path as utoipa_path;

use crate::{
    auth::AuthenticatedKey,
    models::{EmbeddingData, EmbeddingInput, EmbeddingRequest, EmbeddingResponse},
    state::GatewayState,
};

/// Gera embeddings para texto (OpenAI-compatible).
#[utoipa_path(
    post,
    path = "/v1/embeddings",
    tag = "embeddings",
    request_body = EmbeddingRequest,
    responses(
        (status = 200, description = "Embeddings gerados", body = EmbeddingResponse),
        (status = 401, description = "API key invalida"),
        (status = 429, description = "Rate limit excedido")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn embed(
    State(state): State<GatewayState>,
    Extension(_auth): Extension<AuthenticatedKey>,
    Json(req): Json<EmbeddingRequest>,
) -> Result<Json<EmbeddingResponse>, (StatusCode, Json<serde_json::Value>)> {
    let texts: Vec<String> = match req.input {
        EmbeddingInput::Single(s) => vec![s],
        EmbeddingInput::Batch(v) => v,
    };

    let internal_url = format!("{}/embed", state.config.internal_api_url
        .replace("api:3000", "embedding:8001"));

    let resp = state
        .http
        .post(&internal_url)
        .json(&serde_json::json!({ "texts": texts }))
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": { "message": e.to_string() } })),
            )
        })?;

    let data: serde_json::Value = resp.json().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": { "message": e.to_string() } })),
        )
    })?;

    let embeddings = data["embeddings"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let embedding_data: Vec<EmbeddingData> = embeddings
        .iter()
        .enumerate()
        .map(|(i, e)| EmbeddingData {
            object: "embedding".to_string(),
            index: i as u32,
            embedding: e
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|v| v.as_f64().map(|f| f as f32))
                .collect(),
        })
        .collect();

    Ok(Json(EmbeddingResponse {
        object: "list".to_string(),
        data: embedding_data,
        model: req.model,
    }))
}
