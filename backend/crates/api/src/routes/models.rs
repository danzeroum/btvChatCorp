use axum::{
    extract::State,
    routing::get,
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelInfo>,
}

#[derive(Deserialize)]
struct OllamaModelInfo {
    name: String,
    size: i64,
}

#[derive(Serialize)]
struct ModelItem {
    id: String,
    name: String,
    size_gb: f32,
    is_default: bool,
}

#[derive(Serialize)]
struct ModelListResponse {
    models: Vec<ModelItem>,
    default_model: String,
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/models", get(list_models))
}

async fn list_models(
    _auth: Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<ModelListResponse>, AppError> {
    let result = reqwest::Client::new()
        .get(format!("{}/api/tags", state.ollama_url))
        .send()
        .await;

    let models = match result {
        Ok(resp) if resp.status().is_success() => {
            let tags = resp
                .json::<OllamaTagsResponse>()
                .await
                .unwrap_or(OllamaTagsResponse { models: vec![] });
            tags.models
                .into_iter()
                .map(|m| ModelItem {
                    is_default: m.name == state.ollama_model,
                    name: m.name.split(':').next().unwrap_or(&m.name).to_string(),
                    size_gb: m.size as f32 / 1_073_741_824.0,
                    id: m.name,
                })
                .collect()
        }
        _ => {
            // Ollama unavailable — return the configured default only
            vec![ModelItem {
                id: state.ollama_model.clone(),
                name: state
                    .ollama_model
                    .split(':')
                    .next()
                    .unwrap_or(&state.ollama_model)
                    .to_string(),
                size_gb: 0.0,
                is_default: true,
            }]
        }
    };

    Ok(Json(ModelListResponse {
        default_model: state.ollama_model.clone(),
        models,
    }))
}
