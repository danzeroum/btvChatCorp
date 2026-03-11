use std::sync::Arc;

use axum::{
    extract::State,
    response::sse::{Event, Sse},
    Json,
};
use futures::stream::{self, Stream, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use uuid::Uuid;

use rag_searcher::{
    RagSearcher, SearchConfig, SearchFilters,
    prompt_builder::{ConversationMessage, PromptBuilder, WorkspaceContext},
};

use crate::{
    errors::OrchestratorError,
    llm_client::{LlmClient, VllmMessage},
    training_repo::{CreateInteraction, Feedback, TrainingRepo},
};

// ─── Tipos de request / response ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub message: String,
    pub conversation_history: Vec<ConversationMessage>,
    pub workspace_id: Uuid,
    pub project_id: Option<Uuid>,
    /// Filtros opcionais para o RAG
    pub document_ids: Option<Vec<String>>,
    /// Número de chunks RAG a buscar (default 5)
    pub top_k: Option<usize>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    /// Dados de classificação vindos do frontend
    pub data_classification: Option<String>,
    pub pii_detected: Option<bool>,
    pub eligible_for_training: Option<bool>,
    /// Setor do workspace — usado para escolher SearchConfig correto
    pub sector: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SsePayload {
    Token { data: String },
    Sources { data: serde_json::Value },
    Done { interaction_id: String },
    Error { message: String },
}

// ─── Estado injetável ─────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct OrchestratorState {
    pub llm: LlmClient,
    pub rag: Arc<RagSearcher>,
    pub training: TrainingRepo,
    pub prompt_builder: Arc<PromptBuilder>,
}

// ─── Handler principal ────────────────────────────────────────────────────────

/// Handler Axum que orquestra RAG → Prompt → vLLM streaming → coleta de treino.
/// Retorna Server-Sent Events (SSE) com tokens em tempo real.
pub async fn chat_stream_handler(
    State(state): State<Arc<OrchestratorState>>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, anyhow::Error>>>, axum::http::StatusCode> {
    // ── 1. Busca contexto RAG ────────────────────────────────────────────────
    let search_config = SearchConfig::for_sector(
        req.sector.as_deref().unwrap_or("generic"),
        req.top_k,
    );

    let filters = req.document_ids.as_ref().map(|ids| SearchFilters {
        document_id: ids.first().cloned(),
        ..Default::default()
    });

    let rag_result = state
        .rag
        .search(
            &req.message,
            req.workspace_id,
            search_config.top_k,
            filters,
            Some(search_config),
        )
        .await
        .map_err(|e| {
            tracing::error!("RAG search failed: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let sources_json = serde_json::to_value(
        rag_result
            .chunks
            .iter()
            .map(|c| {
                serde_json::json!({
                    "document_id": c.document_id,
                    "section": c.section_title,
                    "score": c.rerank_score,
                    "preview": &c.content[..c.content.len().min(200)],
                })
            })
            .collect::<Vec<_>>(),
    )
    .unwrap_or_default();

    // ── 2. Monta prompt ──────────────────────────────────────────────────────
    let workspace_ctx = WorkspaceContext {
        company_name: "Empresa".into(), // TODO: buscar do DB
        sector: req.sector.clone().unwrap_or_else(|| "generic".into()),
        preferred_tone: None,
        language: Some("Português brasileiro".into()),
        custom_system_prompt: None,
    };

    let llm_messages: Vec<VllmMessage> = state
        .prompt_builder
        .build(
            &req.message,
            &rag_result,
            &req.conversation_history,
            &workspace_ctx,
        )
        .into_iter()
        .map(|m| VllmMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    // ── 3. Cria registro de treino (sem resposta ainda) ──────────────────────
    let interaction_id = state
        .training
        .create_interaction(CreateInteraction {
            workspace_id: req.workspace_id,
            user_message: req.message.clone(),
            rag_context: Some(sources_json.clone()),
            data_classification: req.data_classification.clone(),
            pii_detected: req.pii_detected.unwrap_or(false),
            eligible_for_training: req.eligible_for_training.unwrap_or(true),
            model_version: state.llm.config.display_name(),
            project_id: req.project_id,
        })
        .await
        .map_err(|e| {
            tracing::error!("DB create_interaction failed: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // ── 4. Inicia stream do vLLM ─────────────────────────────────────────────
    let token_stream = state
        .llm
        .chat_stream(
            llm_messages,
            req.temperature.unwrap_or(0.7),
            req.max_tokens.unwrap_or(2048),
        )
        .await
        .map_err(|e| {
            tracing::error!("LLM stream start failed: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Buffer para acumular a resposta completa e salvar no DB ao final
    let full_response = Arc::new(Mutex::new(String::new()));
    let full_response_clone = full_response.clone();
    let state_clone = state.clone();
    let interaction_id_clone = interaction_id;

    // ── 5. Converte stream de tokens → SSE ──────────────────────────────────
    let sources_event = stream::once(async move {
        let payload = SsePayload::Sources { data: sources_json };
        Ok::<Event, anyhow::Error>(
            Event::default().data(serde_json::to_string(&payload).unwrap_or_default()),
        )
    });

    let token_events = token_stream.map(move |result| match result {
        Err(e) => {
            let payload = SsePayload::Error {
                message: e.to_string(),
            };
            Ok::<Event, anyhow::Error>(
                Event::default()
                    .data(serde_json::to_string(&payload).unwrap_or_default()),
            )
        }
        Ok(token) => {
            // Acumula token na resposta completa
            let fr = full_response.clone();
            let tok_clone = token.clone();
            tokio::spawn(async move {
                fr.lock().await.push_str(&tok_clone);
            });

            let payload = SsePayload::Token { data: token };
            Ok::<Event, anyhow::Error>(
                Event::default()
                    .data(serde_json::to_string(&payload).unwrap_or_default()),
            )
        }
    });

    // Evento final: salva resposta completa no DB e emite "done"
    let done_event = stream::once(async move {
        let response_text = full_response_clone.lock().await.clone();

        // Salva resposta no DB para treinamento futuro
        if let Err(e) = state_clone
            .training
            .update_response(interaction_id_clone, response_text, 0, 0)
            .await
        {
            tracing::warn!("Failed to persist response for training: {}", e);
        }

        let payload = SsePayload::Done {
            interaction_id: interaction_id_clone.to_string(),
        };
        Ok::<Event, anyhow::Error>(
            Event::default().data(serde_json::to_string(&payload).unwrap_or_default()),
        )
    });

    let full_stream = sources_event.chain(token_events).chain(done_event);

    Ok(Sse::new(full_stream))
}

// ─── Handler de feedback ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct FeedbackRequest {
    pub interaction_id: Uuid,
    pub rating: Option<String>,
    pub correction: Option<String>,
    pub categories: Option<String>,
    pub user_id: Uuid,
}

pub async fn submit_feedback_handler(
    State(state): State<Arc<OrchestratorState>>,
    Json(req): Json<FeedbackRequest>,
) -> axum::http::StatusCode {
    let has_correction = req.correction.is_some();

    let fb = Feedback {
        rating: req.rating,
        correction: req.correction,
        categories: req.categories,
        user_id: req.user_id,
    };

    if let Err(e) = state.training.add_feedback(req.interaction_id, fb).await {
        tracing::error!("add_feedback failed: {}", e);
        return axum::http::StatusCode::INTERNAL_SERVER_ERROR;
    }

    // Correção manual → alta prioridade de curadoria
    if has_correction {
        let _ = state
            .training
            .flag_high_priority(req.interaction_id)
            .await;
    }

    axum::http::StatusCode::OK
}
