use axum::{
    extract::{Extension, State},
    http::StatusCode,
    Json,
};
use utoipa::path as utoipa_path;

use crate::{
    auth::AuthenticatedKey,
    models::{ChatCompletionRequest, ChatCompletionResponse, ChatMessage, Choice, Usage},
    state::GatewayState,
};

/// Cria uma completion de chat (OpenAI-compatible).
///
/// Suporta os mesmos campos que a API da OpenAI. O BTV Gateway adiciona
/// contexto RAG automaticamente com base nos documentos do workspace.
#[utoipa_path(
    post,
    path = "/v1/chat/completions",
    tag = "chat",
    request_body = ChatCompletionRequest,
    responses(
        (status = 200, description = "Completion gerada", body = ChatCompletionResponse),
        (status = 401, description = "API key invalida"),
        (status = 429, description = "Rate limit excedido")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn completions(
    State(state): State<GatewayState>,
    Extension(auth): Extension<AuthenticatedKey>,
    Json(req): Json<ChatCompletionRequest>,
) -> Result<Json<ChatCompletionResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Repassa para a API interna com workspace_id injetado
    let internal_url = format!(
        "{}/api/v1/gateway/chat",
        state.config.internal_api_url
    );

    let body = serde_json::json!({
        "workspace_id": auth.workspace_id,
        "messages": req.messages,
        "model": req.model,
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
    });

    let resp = state
        .http
        .post(&internal_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "error": { "message": format!("Erro interno: {}", e), "type": "server_error" }
                })),
            )
        })?;

    if !resp.status().is_success() {
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({
                "error": { "message": "Erro na API interna", "type": "server_error" }
            })),
        ));
    }

    let id = format!("chatcmpl-{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().timestamp();

    // Parse da resposta interna
    let data: serde_json::Value = resp.json().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": { "message": e.to_string() } })),
        )
    })?;

    let content = data["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(Json(ChatCompletionResponse {
        id,
        object: "chat.completion".to_string(),
        created: now,
        model: req.model,
        choices: vec![Choice {
            index: 0,
            message: ChatMessage {
                role: "assistant".to_string(),
                content,
            },
            finish_reason: "stop".to_string(),
        }],
        usage: Usage {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
    }))
}
