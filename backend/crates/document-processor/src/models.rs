use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataClassification {
    Public,
    Internal,
    Confidential,
    Restricted,
}

#[derive(Debug, Clone)]
pub struct DocumentJob {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub storage_path: String, // caminho local após download do object storage
    pub classification: DataClassification,
    pub use_for_training: bool,
}

#[derive(Debug)]
pub struct ExtractedDocument {
    pub raw_text: String,
    pub sections: Vec<DocumentSection>,
    pub has_tables: bool,
    pub page_breaks: Vec<usize>, // posições no texto onde há quebra de página
    pub extraction_method: String, // "pdf_native" | "tesseract_ocr" | "docx" | "plaintext"
}

#[derive(Debug)]
pub struct DocumentSection {
    pub title: String,
    pub content: String,
    pub level: u32, // 1=H1, 2=H2, 3=H3...
    pub section_type: SectionType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SectionType {
    Header,
    Body,
    Table,
    List,
    Footer,
    LegalClause,
    MedicalSection,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProcessingDocument {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub filename: String,
    pub original_filename: Option<String>,
    pub mime_type: Option<String>,
    pub storage_path: Option<String>,
    pub processing_status: String,
    pub retry_count: i32,
}
