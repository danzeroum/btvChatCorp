use std::path::Path;
use anyhow::{Result, bail};
use tracing::{info, warn};

use crate::models::{ExtractedDocument, DocumentSection, SectionType};

// ---------------------------------------------------------------------------
// Extrator principal — roteia por mime_type
// ---------------------------------------------------------------------------

pub struct TextExtractor;

impl TextExtractor {
    /// Ponto de entrada: detecta formato e delega
    pub async fn extract(filepath: &Path, mime_type: &str) -> Result<ExtractedDocument> {
        info!("Extraindo texto: {:?} ({})", filepath, mime_type);
        match mime_type {
            "application/pdf" => Self::extract_pdf(filepath).await,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            | "application/msword" => Self::extract_docx(filepath).await,
            "text/plain" | "text/markdown" => Self::extract_text(filepath).await,
            "text/csv" => Self::extract_text(filepath).await,
            "text/html" => Self::extract_html(filepath).await,
            other => bail!("Formato não suportado: {other}"),
        }
    }

    // -----------------------------------------------------------------------
    // PDF — texto selecionável primeiro, OCR como fallback
    // -----------------------------------------------------------------------
    async fn extract_pdf(path: &Path) -> Result<ExtractedDocument> {
        let bytes = tokio::fs::read(path).await?;
        match pdf_extract::extract_text_from_mem(&bytes) {
            Ok(text) if !text.trim().is_empty() => {
                info!("PDF nativo OK: {} chars", text.len());
                let sections = Self::detect_structure(&text);
                let has_tables = Self::detect_tables(&text);
                Ok(ExtractedDocument {
                    raw_text: text,
                    sections,
                    has_tables,
                    page_breaks: vec![],
                    extraction_method: "pdf_native".into(),
                })
            }
            _ => {
                // Fallback: texto simples do conteúdo binário
                warn!("PDF sem texto selecionável, usando fallback plaintext");
                let text = String::from_utf8_lossy(&bytes)
                    .chars()
                    .filter(|c| c.is_ascii_graphic() || c.is_whitespace())
                    .collect::<String>();
                Ok(ExtractedDocument {
                    raw_text: text,
                    sections: vec![],
                    has_tables: false,
                    page_breaks: vec![],
                    extraction_method: "pdf_fallback".into(),
                })
            }
        }
    }

    // -----------------------------------------------------------------------
    // DOCX
    // -----------------------------------------------------------------------
    async fn extract_docx(path: &Path) -> Result<ExtractedDocument> {
        let bytes = tokio::fs::read(path).await?;
        // docx-rs expoe o XML internamente; extraimos o texto de cada parágrafo
        let docx = docx_rs::read_docx(&bytes)?;
        let mut paragraphs: Vec<String> = Vec::new();
        for child in &docx.document.body.children {
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
                if !text.trim().is_empty() {
                    paragraphs.push(text);
                }
            }
        }
        let raw_text = paragraphs.join("\n\n");
        let sections = Self::detect_structure(&raw_text);
        Ok(ExtractedDocument {
            raw_text,
            sections,
            has_tables: false,
            page_breaks: vec![],
            extraction_method: "docx".into(),
        })
    }

    // -----------------------------------------------------------------------
    // Texto plano / CSV / Markdown
    // -----------------------------------------------------------------------
    async fn extract_text(path: &Path) -> Result<ExtractedDocument> {
        let raw_text = tokio::fs::read_to_string(path).await?;
        let sections = Self::detect_structure(&raw_text);
        Ok(ExtractedDocument {
            raw_text,
            sections,
            has_tables: false,
            page_breaks: vec![],
            extraction_method: "plaintext".into(),
        })
    }

    // -----------------------------------------------------------------------
    // HTML — remove tags, mantém texto
    // -----------------------------------------------------------------------
    async fn extract_html(path: &Path) -> Result<ExtractedDocument> {
        let raw_html = tokio::fs::read_to_string(path).await?;
        // Remove tags HTML simples
        let tag_re = regex::Regex::new(r"<[^>]+>").unwrap();
        let raw_text = tag_re.replace_all(&raw_html, " ").to_string();
        // Normaliza espaços múltiplos
        let space_re = regex::Regex::new(r"[ \t]+").unwrap();
        let raw_text = space_re.replace_all(&raw_text, " ").to_string();
        let sections = Self::detect_structure(&raw_text);
        Ok(ExtractedDocument {
            raw_text,
            sections,
            has_tables: raw_html.to_lowercase().contains("<table"),
            page_breaks: vec![],
            extraction_method: "html".into(),
        })
    }

    // -----------------------------------------------------------------------
    // Helpers: estrutura, tabelas, nível de título
    // -----------------------------------------------------------------------

    fn detect_structure(text: &str) -> Vec<DocumentSection> {
        let mut sections: Vec<DocumentSection> = Vec::new();
        let mut current = DocumentSection::default();

        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() { continue; }

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
                if !current.content.is_empty() {
                    current.content.push('\n');
                }
                current.content.push_str(trimmed);
            }
        }
        if !current.content.is_empty() {
            sections.push(current);
        }
        sections
    }

    fn is_section_header(line: &str) -> bool {
        // Padrões: "1.", "Art. 5", "CLÁUSULA", "##", linhas curtas em caps
        let patterns = [
            r"^\d+\.\d*\s+[A-Z]",     // 1.1 Título
            r"(?i)^(art\.?|artigo)\s+\d+",
            r"(?i)^(cláusula|capítulo|seção|parte)\s+",
            r"^#{1,4}\s+",            // Markdown heading
        ];
        patterns.iter().any(|p| regex::Regex::new(p).unwrap().is_match(line))
            || (line.len() < 80 && line == line.to_uppercase() && line.len() > 5)
    }

    fn detect_header_level(line: &str) -> u32 {
        if line.starts_with("#### ") { return 4; }
        if line.starts_with("### ") { return 3; }
        if line.starts_with("## ") { return 2; }
        if line.starts_with("# ") { return 1; }
        // Número de pontos no prefixo numérico: 1. -> 1, 1.1 -> 2
        let dot_count = line.splitn(3, '.').count().saturating_sub(1) as u32;
        dot_count.max(1)
    }

    fn classify_section(title: &str) -> SectionType {
        let lower = title.to_lowercase();
        let legal = ["cláusula", "artigo", "art.", "penalidade", "obrigação", "contrato"];
        let medical = ["anamnese", "diagnóstico", "prescrição", "evolução", "prontuário"];
        let financial = ["balanço", "receita", "despesa", "ativo", "passivo", "resultado"];
        if legal.iter().any(|k| lower.contains(k)) { return SectionType::Legal; }
        if medical.iter().any(|k| lower.contains(k)) { return SectionType::Medical; }
        if financial.iter().any(|k| lower.contains(k)) { return SectionType::Financial; }
        SectionType::Generic
    }

    fn detect_tables(text: &str) -> bool {
        // Heurística: linhas com múltiplos separadores de coluna
        text.lines()
            .filter(|l| l.matches('|').count() >= 2 || l.matches('\t').count() >= 2)
            .count()
            >= 3
    }
}
