use std::sync::Arc;

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::sse::{Event, Sse},
    Json,
};
use futures::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use ai_orchestrator::{
    chat_handler::{ChatRequest, FeedbackRequest},
    llm_client::VllmMessage,
    TrainingRepo, CreateInteraction,
};
use rag_searcher::{
    SearchConfig, SearchFilters,
    prompt_builder::{ConversationMessage, WorkspaceContext},
};

use crate::{
    errors::{error_response, ApiError},
    middleware::api_key_auth::ApiKeyContext,
    state::AppState,
};

// ─── Tipos de request/response ────────────────────────────────────────────────

/// Request compatível com formato OpenAI
#[derive(Debug, Deserialize, ToSchema)]
pub struct ChatCompletionRequest {
    /// Lista de mensagens da conversa
    pub messages: Vec<Message>,
    /// ID do projeto (usa documentos e instruções do projeto como contexto)
    pub project_id: Option<String>,
    /// IDs de documentos específicos para contexto RAG
    pub document_ids: Option<Vec<String>>,
    /// Se true, retorna streaming SSE
    #[serde(default)]
    pub stream: bool,
    /// Temperatura (0-1). Menor = mais determinístico
    pub temperature: Option<f32>,
    /// Máximo de tokens na resposta
    pub max_tokens: Option<u32>,
    /// Número de documentos RAG a buscar
    pub top_k: Option<usize>,
    /// Se true (default), inclui as fontes RAG usadas
    #[serde(default = "default_true")]
    pub include_sources: bool,
    /// Metadados customizados passados de volta no webhook
    pub metadata: Option<serde_json::Value>,
}

fn default_true() -> bool { true }

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<Choice>,
    pub usage: UsageInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<SourceReference>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct Choice {
    pub index: u32,
    pub message: Message,
    pub finish_reason: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SourceReference {
    pub document_id: String,
    pub document_name: String,
    pub section: Option<String>,
    pub relevance_score: f32,
    /// Primeiros 200 chars do chunk
    pub content_preview: String,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// POST /api/v1/chat/completions — modo bloqueante
/// Formato compatível com OpenAI para fácil integração via n8n/Zapier
#[utoipa::path(
    post,
    path = "/api/v1/chat/completions",
    tag = "Chat",
    request_body = ChatCompletionRequest,
    responses(
        (status = 200, description = "Completion gerado com sucesso", body = ChatCompletionResponse),
        (status = 401, description = "API key inválida"),
        (status = 403, description = "Sem permissão para chat"),
        (status = 429, description = "Rate limit excedido"),
    ),
    security(("api_key" = []))
)]
pub async fn create_completion(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Json(request): Json<ChatCompletionRequest>,
) -> Result<Json<ChatCompletionResponse>, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("chat", "write") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions",
            "API key does not have chat:write permission"));
    }

    // 1. Busca contexto RAG
    let query = request.messages.iter().rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.as_str())
        .unwrap_or("");

    let rag = app.rag.search(
        query,
        ctx.workspace_id,
        request.top_k.unwrap_or(5),
        None,
        Some(SearchConfig::default()),
    ).await.map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "rag_error", e.to_string()))?;

    // 2. Monta mensagens com contexto RAG
    let rag_context = app.prompt_builder.format_rag_context(&rag);
    let mut messages: Vec<VllmMessage> = request.messages.iter().map(|m| VllmMessage {
        role: m.role.clone(),
        content: m.content.clone(),
    }).collect();

    if !rag_context.is_empty() {
        messages.insert(0, VllmMessage {
            role: "system".into(),
            content: format!("Documentos de referência:\n{}", rag_context),
        });
    }

    // 3. Chama LLM
    let llm_resp = app.llm.chat(
        messages,
        request.temperature.unwrap_or(0.7),
        request.max_tokens.unwrap_or(2048),
    ).await.map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "llm_error", e.to_string()))?;

    // 4. Monta response
    let completion_id = format!("chatcmpl-{}", Uuid::new_v4());
    let sources = if request.include_sources {
        Some(rag.chunks.iter().map(|c| SourceReference {
            document_id: c.document_id.clone(),
            document_name: c.section_title.clone().unwrap_or_else(|| "Document".into()),
            section: c.section_title.clone(),
            relevance_score: c.rerank_score,
            content_preview: c.content.chars().take(200).collect(),
        }).collect())
    } else {
        None
    };

    Ok(Json(ChatCompletionResponse {
        id: completion_id,
        object: "chat.completion".into(),
        created: chrono::Utc::now().timestamp(),
        model: app.llm.config.display_name(),
        choices: vec![Choice {
            index: 0,
            message: Message { role: "assistant".into(), content: llm_resp.text },
            finish_reason: llm_resp.finish_reason,
        }],
        usage: UsageInfo {
            prompt_tokens: llm_resp.prompt_tokens,
            completion_tokens: llm_resp.completion_tokens,
            total_tokens: llm_resp.prompt_tokens + llm_resp.completion_tokens,
        },
        sources,
    }))
}

/// POST /api/v1/chat/completions/stream — streaming SSE
#[utoipa::path(
    post,
    path = "/api/v1/chat/completions/stream",
    tag = "Chat",
    request_body = ChatCompletionRequest,
    responses((status = 200, description = "Stream de tokens via SSE")),
    security(("api_key" = []))
)]
pub async fn create_streaming_completion(
    State(app): State<AppState>,
    Extension(ctx): Extension<ApiKeyContext>,
    Json(request): Json<ChatCompletionRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, anyhow::Error>>>, (StatusCode, Json<ApiError>)> {
    if !ctx.has_permission("chat", "write") {
        return Err(error_response(StatusCode::FORBIDDEN, "insufficient_permissions",
            "API key does not have chat:write permission"));
    }

    let query = request.messages.iter().rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.as_str())
        .unwrap_or("");

    let rag = app.rag.search(
        query, ctx.workspace_id, request.top_k.unwrap_or(5), None, None,
    ).await.map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "rag_error", e.to_string()))?;

    let rag_context = app.prompt_builder.format_rag_context(&rag);
    let mut messages: Vec<VllmMessage> = request.messages.iter().map(|m| VllmMessage {
        role: m.role.clone(),
        content: m.content.clone(),
    }).collect();
    if !rag_context.is_empty() {
        messages.insert(0, VllmMessage {
            role: "system".into(),
            content: format!("Documentos de referência:\n{}", rag_context),
        });
    }

    let completion_id = format!("chatcmpl-{}", Uuid::new_v4());
    let cid = completion_id.clone();

    let token_stream = app.llm
        .chat_stream(messages, request.temperature.unwrap_or(0.7), request.max_tokens.unwrap_or(2048))
        .await
        .map_err(|e| error_response(StatusCode::INTERNAL_SERVER_ERROR, "llm_error", e.to_string()))?;

    // Converte tokens em SSE compatível com OpenAI
    let sse_stream = token_stream.map(move |result| {
        match result {
            Ok(token) => {
                let data = serde_json::json!({
                    "id": cid,
                    "object": "chat.completion.chunk",
                    "created": chrono::Utc::now().timestamp(),
                    "choices": [{"index": 0, "delta": {"content": token}, "finish_reason": null}]
                });
                Ok(Event::default().data(serde_json::to_string(&data).unwrap_or_default()))
            }
            Err(e) => Ok(Event::default().data(format!("{{\"error\":\"{}\"}}", e)))
        }
    });

    Ok(Sse::new(sse_stream))
}
