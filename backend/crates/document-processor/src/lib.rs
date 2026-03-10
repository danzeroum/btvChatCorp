pub mod extractor;
pub mod cleaner;
pub mod chunker;
pub mod embedder;
pub mod indexer;
pub mod strategy_selector;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DataClassification {
    Public,
    Internal,
    Confidential,
    Restricted,
}

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
    pub page_count: Option<u32>,
    pub language: String,
    pub sector: Option<String>,
    pub custom_tags: Vec<String>,
}

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
    pub previous_chunk_id: Option<Uuid>,
    pub next_chunk_id: Option<Uuid>,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
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
pub enum LegalSection {
    Clause,
    Definition,
    Obligation,
    Penalty,
    GeneralProvision,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MedicalSection {
    Anamnesis,
    Diagnosis,
    Prescription,
    LabResult,
    Evolution,
}
