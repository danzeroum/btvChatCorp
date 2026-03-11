use std::sync::Arc;
use sqlx::PgPool;
use rag_searcher::RagSearcher;
use ai_orchestrator::{LlmClient, TrainingRepo};
use rag_searcher::prompt_builder::PromptBuilder;

/// Estado global injetável em todos os handlers via `State<AppState>`
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub rag: Arc<RagSearcher>,
    pub llm: LlmClient,
    pub training: TrainingRepo,
    pub prompt_builder: Arc<PromptBuilder>,
    pub vllm_url: String,
    pub embedding_url: String,
    pub start_time: std::time::Instant,
}
