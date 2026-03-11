use thiserror::Error;

#[derive(Debug, Error)]
pub enum SearchError {
    #[error("Qdrant error: {0}")]
    Qdrant(String),

    #[error("Embedding service error: {0}")]
    EmbeddingService(String),

    #[error("Reranker service error: {0}")]
    RerankerService(String),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}
