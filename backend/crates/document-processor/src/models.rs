use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Documento em cada estágio do pipeline
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawDocument {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub storage_path: String,  // caminho local após download do object storage
    pub classification: DataClassification,
    pub use_for_training: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedDocument {
    pub raw_text: String,
    pub sections: Vec<DocumentSection>,
    pub has_tables: bool,
    pub page_breaks: Vec<usize>,   // posições no texto onde há quebra de página
    pub extraction_method: String, // "pdf_native" | "tesseract_ocr" | "docx" | "plaintext"
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DocumentSection {
    pub title: String,
    pub content: String,
    pub level: u32,          // 1=H1, 2=H2, 3=H3…
    pub section_type: SectionType,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum SectionType {
    #[default]
    Generic,
    Legal,
    Medical,
    Financial,
    Technical,
    Table,
}

// ---------------------------------------------------------------------------
// Chunk — unidade atômica do RAG
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    pub id: Uuid,
    pub document_id: Uuid,
    pub workspace_id: Uuid,
    pub content: String,
    pub chunk_index: u32,
    pub total_chunks: u32,
    pub section_title: Option<String>,
    pub page_number: Option<u32>,
    pub chunk_type: ChunkType,
    pub token_count: u32,
    /// Encadeamento para context window retrieval
    pub previous_chunk_id: Option<Uuid>,
    pub next_chunk_id: Option<Uuid>,
    /// Preenchido após embedding
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum ChunkType {
    #[default]
    Paragraph,
    Table,
    List,
    CodeBlock,
    Header,
    LegalClause,
    MedicalSection,
}

impl std::fmt::Display for ChunkType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ChunkType::Paragraph => "paragraph",
            ChunkType::Table => "table",
            ChunkType::List => "list",
            ChunkType::CodeBlock => "code_block",
            ChunkType::Header => "header",
            ChunkType::LegalClause => "legal_clause",
            ChunkType::MedicalSection => "medical_section",
        };
        write!(f, "{s}")
    }
}

// ---------------------------------------------------------------------------
// Classificação de dados (herdada do workspace)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub enum DataClassification {
    #[default]
    Internal,
    Public,
    Confidential,
    Restricted, // não vai para treino nem para RAG geral
}

impl std::fmt::Display for DataClassification {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            DataClassification::Internal => "INTERNAL",
            DataClassification::Public => "PUBLIC",
            DataClassification::Confidential => "CONFIDENTIAL",
            DataClassification::Restricted => "RESTRICTED",
        };
        write!(f, "{s}")
    }
}
