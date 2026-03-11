use thiserror::Error;

#[derive(Debug, Error)]
pub enum OrchestratorError {
    #[error("LLM inference error: {0}")]
    LlmInference(String),

    #[error("LLM stream error: {0}")]
    LlmStream(String),

    #[error("RAG search error: {0}")]
    RagSearch(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
