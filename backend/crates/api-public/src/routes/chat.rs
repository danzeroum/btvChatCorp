//! Chat completions da API Pública (compatível com formato OpenAI).
//!
//! Implementação nativa: autentica por API key (`ApiKeyContext`), busca contexto
//! via `search_rag` e chama o Ollama inline — mesmo padrão vivo do `chats.rs` do
//! crate `api`. É **efêmero**: não persiste a conversa (não há `user_id` válido
//! sob API key para gravar `created_by`), o que é a semântica correta para um
//! endpoint OpenAI-compatível (stateless).

use axum::{extract::State, response::Json, routing::post, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::api_key::{require_permission, ApiKeyContext},
};
use crate_api::rag::{build_rag_context, search_rag};
use crate_api::state::AppState;

pub fn chat_routes() -> Router<AppState> {
    Router::new().route("/chat/completions", post(create_completion))
}

#[derive(Debug, Deserialize)]
pub struct ChatCompletionRequest {
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub top_k: Option<usize>,
    #[serde(default = "default_true")]
    pub include_sources: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<Choice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct Choice {
    pub index: u32,
    pub message: ChatMessage,
    pub finish_reason: String,
}

/// POST /api/v1/chat/completions — modo bloqueante, stateless.
pub async fn create_completion(
    State(app): State<AppState>,
    axum::extract::Extension(ctx): axum::extract::Extension<ApiKeyContext>,
    Json(req): Json<ChatCompletionRequest>,
) -> Result<Json<ChatCompletionResponse>, ApiError> {
    require_permission(&ctx, "chat", "write")?;

    // Última mensagem do usuário é a query do RAG.
    let query = req
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.as_str())
        .unwrap_or("");

    let rag_chunks = search_rag(
        &app.qdrant_url,
        &app.embedding_url,
        &ctx.workspace_id.to_string(),
        query,
        req.top_k.unwrap_or(5),
        0.35,
    )
    .await
    .unwrap_or_default();

    let rag_context = build_rag_context(&rag_chunks);
    let system_content = match rag_context {
        Some(c) => format!(
            "Você é um assistente especializado da empresa. Responda em português, \
             seja preciso e cite a fonte entre parênteses quando usar o contexto.\n\n{}",
            c
        ),
        None => "Você é um assistente especializado da empresa. Responda em português, \
                 seja preciso e conciso. Se não souber, diga que não tem a informação."
            .to_string(),
    };

    let mut messages: Vec<serde_json::Value> =
        vec![serde_json::json!({ "role": "system", "content": system_content })];
    messages.extend(
        req.messages
            .iter()
            .map(|m| serde_json::json!({ "role": m.role, "content": m.content })),
    );

    let temperature = req.temperature.unwrap_or(0.7);
    let max_tokens = req.max_tokens.unwrap_or(1024);

    let answer = if std::env::var("OLLAMA_MOCK").as_deref() == Ok("true") {
        let info = if rag_chunks.is_empty() {
            "[sem contexto RAG]".to_string()
        } else {
            format!("[{} chunks RAG]", rag_chunks.len())
        };
        format!("[mock] {} — Resposta para: {}", info, query)
    } else {
        call_ollama(
            &app.ollama_url,
            &app.ollama_model,
            app.ollama_auth.as_deref(),
            &messages,
            temperature,
            max_tokens,
        )
        .await
        .map_err(|e| ApiError::new("llm_error", e.to_string()))?
    };

    let sources = if req.include_sources && !rag_chunks.is_empty() {
        Some(serde_json::json!(rag_chunks
            .iter()
            .map(|c| serde_json::json!({
                "filename": c.filename,
                "section": c.section,
                "score": c.score,
            }))
            .collect::<Vec<_>>()))
    } else {
        None
    };

    Ok(Json(ChatCompletionResponse {
        id: format!("chatcmpl-{}", Uuid::new_v4()),
        object: "chat.completion".into(),
        created: chrono::Utc::now().timestamp(),
        model: app.ollama_model.clone(),
        choices: vec![Choice {
            index: 0,
            message: ChatMessage {
                role: "assistant".into(),
                content: answer,
            },
            finish_reason: "stop".into(),
        }],
        sources,
    }))
}

/// Chamada bloqueante ao Ollama (mesmo contrato do `call_llm` do crate `api`).
async fn call_ollama(
    base_url: &str,
    model: &str,
    basic_auth: Option<&str>,
    messages: &[serde_json::Value],
    temperature: f32,
    max_tokens: u32,
) -> Result<String, reqwest::Error> {
    let client = reqwest::Client::new();
    let mut req = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": false,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }));
    if let Some(auth) = basic_auth {
        let mut parts = auth.splitn(2, ':');
        let user = parts.next().unwrap_or("");
        let pass = parts.next().unwrap_or("");
        req = req.basic_auth(user, Some(pass));
    }
    let resp = req.send().await?.json::<serde_json::Value>().await?;
    Ok(resp["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
}
