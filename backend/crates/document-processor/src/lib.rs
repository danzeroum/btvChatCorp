pub mod chunker;
pub mod cleaner;
pub mod embedder;
pub mod errors;
pub mod extractor;
pub mod indexer;
pub mod pipeline;
pub mod strategy_selector;

// ─── Tipos compartilhados por todos os módulos ──────────────────────────────────

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Classificação de sensibilidade do documento
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum DataClassification {
    Public,
    Internal,
    Confidential,
    Restricted, // Não vai para treino
}

/// Representa um documento em qualquer estágio do pipeline
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub classification: DataClassification,
    pub use_for_training: bool,
    pub metadata: DocumentMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DocumentMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub created_at: Option<String>,
    pub page_count: Option<u32>,
    pub language: String, // pt-BR, en, es
    pub sector: Option<String>, // legal, health, finance, generic
    pub custom_tags: Vec<String>,
}

/// Unidade atômica do RAG — o que vai para o Qdrant
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
    /// Links para navegação de contexto
    pub previous_chunk_id: Option<Uuid>,
    pub next_chunk_id: Option<Uuid>,
    /// Preenchido após embedding
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChunkType {
    Paragraph,
    Table,
    List,
    CodeBlock,
    Header,
    Legal(LegalSection),
    Medical(MedicalSection),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LegalSection {
    Clause,
    Definition,
    Obligation,
    Penalty,
    GeneralProvision,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MedicalSection {
    Anamnesis,
    Diagnosis,
    Prescription,
    LabResult,
    Evolution,
}

/// Tipo de seção detectada na estrutura do documento
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SectionType {
    #[default]
    Generic,
    Legal(LegalSection),
    Medical(MedicalSection),
}

/// Seção estrutural do documento
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DocumentSection {
    pub title: String,
    pub content: String,
    pub level: u8, // 1 = H1, 2 = H2, etc.
    pub section_type: SectionType,
}
