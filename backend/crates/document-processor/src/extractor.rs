use std::path::Path;
use serde::{Deserialize, Serialize};

use crate::{
    errors::ExtractionError,
    DocumentSection, SectionType, LegalSection, MedicalSection,
};

/// Documento após extraeço de texto
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedDocument {
    pub raw_text: String,
    pub sections: Vec<DocumentSection>,
    pub extraction_method: String,
    pub has_tables: bool,
    pub page_breaks: Vec<usize>, // posições de quebra de página
}

#[derive(Debug, Deserialize)]
pub struct OcrResponse {
    pub text: String,
    pub sections: Vec<DocumentSection>,
    pub has_tables: bool,
    pub page_breaks: Vec<usize>,
}

pub struct TextExtractor {
    pub ocr_service_url: String,
}

impl TextExtractor {
    pub fn new(ocr_service_url: impl Into<String>) -> Self {
        Self { ocr_service_url: ocr_service_url.into() }
    }

    /// Roteador principal: detecta formato e chama extrator específico
    pub async fn extract(
        &self,
        filepath: &Path,
        mime_type: &str,
    ) -> Result<ExtractedDocument, ExtractionError> {
        match mime_type {
            "application/pdf" => self.extract_pdf(filepath).await,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            | "application/msword" => self.extract_docx(filepath).await,
            "text/plain" | "text/markdown" => self.extract_text(filepath).await,
            "text/html" => self.extract_html(filepath).await,
            _ => Err(ExtractionError::UnsupportedFormat(mime_type.to_string())),
        }
    }

    // ─── PDF ──────────────────────────────────────────────────────────────────

    async fn extract_pdf(&self, path: &Path) -> Result<ExtractedDocument, ExtractionError> {
        let bytes = tokio::fs::read(path).await?;

        // Tenta extraeço direta (PDFs com texto selectável)
        match pdf_extract::extract_text_from_mem(&bytes) {
            Ok(text) if !text.trim().is_empty() && text.len() > 100 => {
                let sections = Self::detect_pdf_structure(&text);
                let has_tables = Self::detect_tables_in_text(&text);
                let page_breaks = Self::detect_page_breaks(&text);
                Ok(ExtractedDocument {
                    raw_text: text,
                    sections,
                    extraction_method: "pdf-extract-native".into(),
                    has_tables,
                    page_breaks,
                })
            }
            // Fallback OCR para PDFs digitalizados (comum em jurídico)
            _ => self.extract_pdf_ocr(path).await,
        }
    }

    /// OCR via serviço Python com Tesseract (PDFs digitalizados)
    async fn extract_pdf_ocr(&self, path: &Path) -> Result<ExtractedDocument, ExtractionError> {
        let file_bytes = tokio::fs::read(path).await?;
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("document.pdf")
            .to_string();

        let part = reqwest::multipart::Part::bytes(file_bytes)
            .file_name(filename)
            .mime_str("application/pdf")
            .map_err(|e| ExtractionError::OcrUnavailable(e.to_string()))?;

        let form = reqwest::multipart::Form::new().part("file", part);

        let response: OcrResponse = reqwest::Client::new()
            .post(format!("{}/ocr", self.ocr_service_url))
            .multipart(form)
            .send()
            .await
            .map_err(|e| ExtractionError::OcrUnavailable(e.to_string()))?
            .json()
            .await
            .map_err(|e| ExtractionError::OcrUnavailable(e.to_string()))?;

        Ok(ExtractedDocument {
            raw_text: response.text,
            sections: response.sections,
            extraction_method: "tesseract-ocr".into(),
            has_tables: response.has_tables,
            page_breaks: response.page_breaks,
        })
    }

    // ─── DOCX ────────────────────────────────────────────────────────────────

    async fn extract_docx(&self, path: &Path) -> Result<ExtractedDocument, ExtractionError> {
        let bytes = tokio::fs::read(path).await?;

        let docx = docx_rs::read_docx(&bytes)
            .map_err(|e| ExtractionError::DocxError(format!("{:?}", e)))?;

        let mut paragraphs: Vec<String> = Vec::new();
        let mut sections: Vec<DocumentSection> = Vec::new();
        let mut current_section = DocumentSection::default();

        for child in &docx.document.children {
            if let docx_rs::DocumentChild::Paragraph(p) = child {
                let text: String = p
                    .children
                    .iter()
                    .filter_map(|c| {
                        if let docx_rs::ParagraphChild::Run(r) = c {
                            Some(
                                r.children
                                    .iter()
                                    .filter_map(|rc| {
                                        if let docx_rs::RunChild::Text(t) = rc {
                                            Some(t.text.clone())
                                        } else {
                                            None
                                        }
                                    })
                                    .collect::<String>(),
                            )
                        } else {
                            None
                        }
                    })
                    .collect();

                let trimmed = text.trim().to_string();
                if trimmed.is_empty() {
                    continue;
                }

                // Detecta se é um cabeçalho de seção
                if Self::is_section_header(&trimmed) {
                    if !current_section.content.is_empty() {
                        sections.push(current_section.clone());
                    }
                    current_section = DocumentSection {
                        title: trimmed.clone(),
                        content: String::new(),
                        level: Self::detect_header_level(&trimmed),
                        section_type: Self::classify_section(&trimmed),
                    };
                } else {
                    current_section.content.push_str(&trimmed);
                    current_section.content.push('\n');
                    paragraphs.push(trimmed);
                }
            }
        }

        if !current_section.content.is_empty() {
            sections.push(current_section);
        }

        let raw_text = paragraphs.join("\n");
        let has_tables = Self::detect_tables_in_text(&raw_text);

        Ok(ExtractedDocument {
            raw_text,
            sections,
            extraction_method: "docx-rs-native".into(),
            has_tables,
            page_breaks: vec![],
        })
    }

    // ─── Texto simples / Markdown ────────────────────────────────────────────────

    async fn extract_text(&self, path: &Path) -> Result<ExtractedDocument, ExtractionError> {
        let text = tokio::fs::read_to_string(path).await?;
        let sections = Self::detect_pdf_structure(&text);
        let has_tables = Self::detect_tables_in_text(&text);

        Ok(ExtractedDocument {
            raw_text: text,
            sections,
            extraction_method: "plain-text".into(),
            has_tables,
            page_breaks: vec![],
        })
    }

    // ─── HTML ─────────────────────────────────────────────────────────────────────

    async fn extract_html(&self, path: &Path) -> Result<ExtractedDocument, ExtractionError> {
        let raw_html = tokio::fs::read_to_string(path).await?;
        // Remove tags HTML e decodifica entidades
        let tag_re = regex::Regex::new(r"<[^>]+>").unwrap();
        let text = tag_re.replace_all(&raw_html, " ").to_string();
        // Normaliza espaços múltiplos
        let ws_re = regex::Regex::new(r"\s{2,}").unwrap();
        let text = ws_re.replace_all(&text, "\n").to_string();

        let sections = Self::detect_pdf_structure(&text);
        let has_tables = raw_html.contains("<table");

        Ok(ExtractedDocument {
            raw_text: text,
            sections,
            extraction_method: "html-strip".into(),
            has_tables,
            page_breaks: vec![],
        })
    }

    // ─── Análise estrutural ───────────────────────────────────────────────────────────

    pub fn detect_pdf_structure(text: &str) -> Vec<DocumentSection> {
        let mut sections: Vec<DocumentSection> = Vec::new();
        let mut current = DocumentSection::default();

        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if Self::is_section_header(trimmed) {
                if !current.content.is_empty() {
                    sections.push(current.clone());
                }
                current = DocumentSection {
                    title: trimmed.to_string(),
                    content: String::new(),
                    level: Self::detect_header_level(trimmed),
                    section_type: Self::classify_section(trimmed),
                };
            } else {
                current.content.push_str(trimmed);
                current.content.push('\n');
            }
        }
        if !current.content.is_empty() {
            sections.push(current);
        }
        sections
    }

    /// Heurísticas para identificar cabeçalhos (PT-BR, jurídico, médico)
    pub fn is_section_header(line: &str) -> bool {
        let patterns: &[&str] = &[
            // Jurídico
            r"(?i)CL[AÁ]USULA",
            r"(?i)Art\.?",
            r"(?i)Artigo",
            r"(?i)CAP[IÍ]TULO\s+[IVXLCDM]+",
            r"(?i)SE[CÇ][AÃ]O\s+[IVXLCDM]+",
            r"(?i)T[IÍ]TULO\s+[IVXLCDM]+",
            // Numéricos genéricos: 1. Objetivo | 1.1 Escopo | 1.1.1
            r"^\d+\.\s+[A-Z]",
            r"^\d+\.\d+\.?\s+[A-Z]",
            r"^\d+\.\d+\.\d+\.?\s+[A-Z]",
            // Linha toda em maiúsculas (contratos BR)
            r"^[A-Z\s]{10,}$",
            // Médico
            r"(?i)anamnese|diagn[oó]stico|prescri[cç][aã]o|evolu[cç][aã]o|exames",
        ];
        patterns.iter().any(|p| {
            regex::Regex::new(p)
                .map(|re| re.is_match(line))
                .unwrap_or(false)
        })
    }

    fn detect_header_level(line: &str) -> u8 {
        if regex::Regex::new(r"^\d+\.\d+\.\d+").unwrap().is_match(line) {
            return 3;
        }
        if regex::Regex::new(r"^\d+\.\d+").unwrap().is_match(line) {
            return 2;
        }
        1
    }

    pub fn classify_section(title: &str) -> SectionType {
        let lower = title.to_lowercase();

        // Jurídico
        if lower.contains("cláusula") || lower.contains("artigo") || lower.contains("art.") {
            if lower.contains("penalidade") || lower.contains("multa") || lower.contains("rescisão") {
                return SectionType::Legal(LegalSection::Penalty);
            }
            if lower.contains("obrigação") || lower.contains("dever") {
                return SectionType::Legal(LegalSection::Obligation);
            }
            if lower.contains("definição") || lower.contains("glossário") {
                return SectionType::Legal(LegalSection::Definition);
            }
            return SectionType::Legal(LegalSection::Clause);
        }

        // Médico
        if lower.contains("anamnese") || lower.contains("história clínica") {
            return SectionType::Medical(MedicalSection::Anamnesis);
        }
        if lower.contains("diagnóstico") || lower.contains("hipótese") {
            return SectionType::Medical(MedicalSection::Diagnosis);
        }
        if lower.contains("prescrição") || lower.contains("receita") {
            return SectionType::Medical(MedicalSection::Prescription);
        }
        if lower.contains("evolução") {
            return SectionType::Medical(MedicalSection::Evolution);
        }

        SectionType::Generic
    }

    pub fn detect_tables_in_text(text: &str) -> bool {
        // Heurística: 3+ linhas consecutivas com 2+ colunas separadas por espaços
        let lines: Vec<&str> = text.lines().collect();
        let mut consecutive = 0usize;
        for line in &lines {
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() >= 2 && line.contains("  ") {
                consecutive += 1;
                if consecutive >= 3 {
                    return true;
                }
            } else {
                consecutive = 0;
            }
        }
        false
    }

    fn detect_page_breaks(text: &str) -> Vec<usize> {
        // Form-feed character \x0C indica quebra de página em PDFs
        text.char_indices()
            .filter_map(|(i, c)| if c == '\x0C' { Some(i) } else { None })
            .collect()
    }
}
