use axum::{
    extract::{State, Json},
    http::StatusCode,
    response::sse::{Event, Sse},
};
use futures::stream::Stream;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use crate::{
    state::AppState,
    models::{ChatRequest, FeedbackRequest, CreateInteraction, Feedback},
    middleware::workspace::WorkspaceContext,
};

/// Handler principal de chat com streaming SSE
pub async fn chat_handler(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Json(request): Json<ChatRequest>,
) -> Sse<impl Stream<Item = Result<Event, anyhow::Error>>> {
    // 1. Busca contexto RAG
    let rag_context = app
        .rag_service
        .search(&request.message, &ctx.workspace_id, 5)
        .await
        .unwrap_or_default();

    // 2. Monta prompt com contexto RAG + histórico + system prompt do workspace
    let full_prompt = app.prompt_builder.build(
        &request.message,
        &rag_context,
        &request.conversation_history,
        &ctx,
    );

    // 3. Cria registro para coleta de treino (antes do stream)
    let interaction_id = app
        .training_repo
        .create_interaction(CreateInteraction {
            workspace_id: ctx.workspace_id.clone(),
            user_message: request.message.clone(),
            rag_context: serde_json::to_value(&rag_context).unwrap_or_default(),
            data_classification: request.classification.clone().unwrap_or_default(),
            pii_detected: request.pii_detected.unwrap_or(false),
            eligible_for_training: request.eligible_for_training.unwrap_or(true),
            model_version: ctx.model_version.clone(),
        })
        .await
        .unwrap_or_else(|_| Uuid::new_v4());

    // 4. Chama vLLM com streaming
    let llm_stream = app
        .llm_client
        .chat_stream(&full_prompt, &ctx.model_config())
        .await
        .expect("Falha ao conectar ao vLLM");

    // 5. Coleta resposta completa enquanto streama
    let response_collector = Arc::new(Mutex::new(String::new()));
    let collector_clone = response_collector.clone();
    let repo = app.training_repo.clone();
    let rag_ctx = rag_context.clone();

    let stream = llm_stream
        .map(move |chunk| {
            if let Ok(ref text) = chunk {
                collector_clone.lock().unwrap().push_str(text);
            }
            Ok(Event::default().data(chunk?))
        })
        .chain(futures::stream::once(async move {
            // Ao finalizar, salva resposta completa no banco
            let full_response = response_collector.lock().unwrap().clone();
            repo.update_response(interaction_id, &full_response)
                .await
                .ok();
            // Envia fontes RAG como último evento
            Ok(Event::default()
                .event("sources")
                .data(serde_json::to_string(&rag_ctx).unwrap_or_default()))
        }));

    Sse::new(stream)
}

/// Handler para receber feedback do usuário
pub async fn submit_feedback(
    ctx: WorkspaceContext,
    State(app): State<AppState>,
    Json(feedback): Json<FeedbackRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    app.training_repo
        .add_feedback(
            feedback.interaction_id,
            Feedback {
                rating: feedback.rating,
                correction: feedback.correction.clone(),
                categories: feedback.categories.clone(),
                user_id: ctx.user_id,
            },
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Correções manuais = alta prioridade para curadoria
    if feedback.correction.is_some() {
        app.training_repo
            .flag_high_priority(feedback.interaction_id)
            .await
            .ok();
    }

    Ok(Json(serde_json::json!({ "status": "ok" })))
}
