use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExtractionError {
    #[error("Unsupported file format: {0}")]
    UnsupportedFormat(String),

    #[error("PDF extraction failed: {0}")]
    PdfError(String),

    #[error("DOCX extraction failed: {0}")]
    DocxError(String),

    #[error("OCR service unavailable: {0}")]
    OcrUnavailable(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
}

#[derive(Debug, Error)]
pub enum IndexError {
    #[error("Qdrant error: {0}")]
    Qdrant(String),

    #[error("Embedding service error: {0}")]
    EmbeddingService(String),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

#[derive(Debug, Error)]
pub enum PipelineError {
    #[error("Extraction error: {0}")]
    Extraction(#[from] ExtractionError),

    #[error("Index error: {0}")]
    Index(#[from] IndexError),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
