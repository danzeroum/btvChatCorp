use axum::{extract::State, Json};
use utoipa::path as utoipa_path;

use crate::models::{Model, ModelsResponse};
use crate::state::GatewayState;

/// Lista modelos disponiveis no BTV Gateway.
#[utoipa_path(
    get,
    path = "/v1/models",
    tag = "models",
    responses(
        (status = 200, description = "Lista de modelos", body = ModelsResponse),
        (status = 401, description = "API key invalida")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn list_models(
    State(_state): State<GatewayState>,
) -> Json<ModelsResponse> {
    let now = chrono::Utc::now().timestamp();
    Json(ModelsResponse {
        object: "list".to_string(),
        data: vec![
            Model {
                id: "btv-llama3-8b".to_string(),
                object: "model".to_string(),
                created: now,
                owned_by: "buildtovalue".to_string(),
            },
            Model {
                id: "btv-llama3-8b-lora".to_string(),
                object: "model".to_string(),
                created: now,
                owned_by: "buildtovalue".to_string(),
            },
        ],
    })
}
