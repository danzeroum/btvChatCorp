use std::path::Path;
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Clone, Default)]
pub struct DocumentSection {
    pub title: String,
    pub content: String,
    pub level: u8,
    pub section_type: SectionType,
}

#[derive(Debug, Clone, Default)]
pub enum SectionType {
    #[default]
    Generic,
    Legal,
    Medical,
    Financial,
}

#[derive(Debug, Clone)]
pub struct ExtractedDocument {
    pub raw_text: String,
    pub sections: Vec<DocumentSection>,
    pub extraction_method: String,
    pub has_tables: bool,
    pub page_breaks: Vec<usize>,
}

pub struct TextExtractor;

impl TextExtractor {
    pub async fn extract(file_path: &Path, mime_type: &str) -> Result<ExtractedDocument> {
        match mime_type {
            "application/pdf" => Self::extract_pdf(file_path).await,
            "text/plain" | "text/markdown" => Self::extract_text(file_path).await,
            "text/html" => Self::extract_html(file_path).await,
            _ => anyhow::bail!("Unsupported format: {}", mime_type),
        }
    }

    async fn extract_pdf(path: &Path) -> Result<ExtractedDocument> {
        let bytes = tokio::fs::read(path).await?;
        match pdf_extract::extract_text_from_mem(&bytes) {
            Ok(text) if !text.trim().is_empty() => {
                let sections = Self::detect_structure(&text);
                Ok(ExtractedDocument {
                    has_tables: Self::detect_tables(&text),
                    page_breaks: Self::detect_page_breaks(&text),
                    sections,
                    extraction_method: "pdf_native".into(),
                    raw_text: text,
                })
            }
            _ => {
                // Fallback OCR via microservice
                Self::extract_via_ocr_service(path).await
            }
        }
    }

    async fn extract_text(path: &Path) -> Result<ExtractedDocument> {
        let text = tokio::fs::read_to_string(path).await?;
        let sections = Self::detect_structure(&text);
        Ok(ExtractedDocument {
            has_tables: false,
            page_breaks: vec![],
            sections,
            extraction_method: "plain_text".into(),
            raw_text: text,
        })
    }

    async fn extract_html(path: &Path) -> Result<ExtractedDocument> {
        let html = tokio::fs::read_to_string(path).await?;
        // Remove HTML tags
        let text = regex::Regex::new(r"<[^>]+>")
            .unwrap()
            .replace_all(&html, " ")
            .to_string();
        let sections = Self::detect_structure(&text);
        Ok(ExtractedDocument {
            has_tables: html.contains("<table"),
            page_breaks: vec![],
            sections,
            extraction_method: "html".into(),
            raw_text: text,
        })
    }

    async fn extract_via_ocr_service(path: &Path) -> Result<ExtractedDocument> {
        let client = reqwest::Client::new();
        let bytes = tokio::fs::read(path).await?;
        let form = reqwest::multipart::Form::new()
            .part("file", reqwest::multipart::Part::bytes(bytes));
        let response: serde_json::Value = client
            .post("http://localhost:8002/ocr")
            .multipart(form)
            .send().await?
            .json().await?;
        let text = response["text"].as_str().unwrap_or("").to_string();
        let sections = Self::detect_structure(&text);
        Ok(ExtractedDocument {
            raw_text: text,
            sections,
            extraction_method: "tesseract_ocr".into(),
            has_tables: false,
            page_breaks: vec![],
        })
    }

    fn detect_structure(text: &str) -> Vec<DocumentSection> {
        let mut sections = Vec::new();
        let mut current = DocumentSection::default();
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() { continue; }
            if Self::is_header(trimmed) {
                if !current.content.is_empty() {
                    sections.push(current.clone());
                }
                current = DocumentSection {
                    title: trimmed.to_string(),
                    content: String::new(),
                    level: Self::header_level(trimmed),
                    section_type: Self::classify_section(trimmed),
                };
            } else {
                current.content.push_str(trimmed);
                current.content.push('\n');
            }
        }
        if !current.content.is_empty() { sections.push(current); }
        sections
    }

    fn is_header(line: &str) -> bool {
        let patterns = [
            r"^(CLÁUSULA|Cláusula|Art\.?|Artigo)\s*\d+",
            r"^\d+\.\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ]",
            r"^\d+\.\d+\s+[A-Z]",
            r"^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]{10,}$",
        ];
        patterns.iter().any(|p| regex::Regex::new(p).unwrap().is_match(line))
    }

    fn header_level(line: &str) -> u8 {
        if regex::Regex::new(r"^\d+\.\d+\.\d+").unwrap().is_match(line) { return 3; }
        if regex::Regex::new(r"^\d+\.\d+").unwrap().is_match(line) { return 2; }
        1
    }

    fn classify_section(title: &str) -> SectionType {
        let lower = title.to_lowercase();
        if lower.contains("cláusula") || lower.contains("artigo") { return SectionType::Legal; }
        if lower.contains("diagnóstico") || lower.contains("anamnese") { return SectionType::Medical; }
        SectionType::Generic
    }

    fn detect_tables(text: &str) -> bool {
        text.lines().filter(|l| l.contains("  ") && l.split("  ").count() >= 3).count() >= 3
    }

    fn detect_page_breaks(text: &str) -> Vec<usize> {
        text.match_indices("\x0C").map(|(i, _)| i).collect()
    }
}
