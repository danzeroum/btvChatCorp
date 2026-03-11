use std::collections::{HashMap, HashSet};
use regex::Regex;
use unicode_normalization::UnicodeNormalization;

use crate::{DocumentSection, extractor::ExtractedDocument};

/// Documento limpo pronto para chunking
#[derive(Debug, Clone)]
pub struct CleanedText {
    pub text: String,
    pub tables: Vec<ExtractedTable>,
    pub language: String,
    pub sections: Vec<DocumentSection>,
}

#[derive(Debug, Clone)]
pub struct ExtractedTable {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub caption: Option<String>,
}

pub struct TextCleaner;

impl TextCleaner {
    pub fn clean(extracted: ExtractedDocument) -> CleanedText {
        let mut text = extracted.raw_text.clone();

        // 1. Remove artefatos de PDF (números de página soltos, etc.)
        text = Self::remove_pdf_artifacts(&text);

        // 2. Normaliza Unicode (NFC) — importante para acentos PT-BR
        text = text.nfc().collect::<String>();

        // 3. Corrige hifenização de fim de linha: "juris-\npão" → "jurisprudência"
        text = Self::fix_hyphenation(&text);

        // 4. Normaliza espaços e quebras de linha
        text = Self::normalize_whitespace(&text);

        // 5. Remove headers/footers repetidos ("Página X de Y", etc.)
        text = Self::remove_repeated_headers_footers(&text);

        // 6. Extrai tabelas e substitui por marcadores
        let (text, tables) = Self::extract_and_mark_tables(text);

        // 7. Detecta idioma
        let language = Self::detect_language(&text);

        CleanedText { text, tables, language, sections: extracted.sections }
    }

    fn remove_pdf_artifacts(text: &str) -> String {
        // Remove form-feed e caracteres de controle exceto \n e \t
        let control_re = Regex::new(r"[\x00-\x08\x0B-\x1F\x7F]").unwrap();
        // Remove linhas que são só número de página
        let page_re = Regex::new(r"(?m)^\s*-?\s*\d+\s*-?\s*$").unwrap();
        let text = control_re.replace_all(text, "");
        page_re.replace_all(&text, "").to_string()
    }

    fn fix_hyphenation(text: &str) -> String {
        // "juris-\npão" -> "jurisprudência" (palavra + hífen + newline + minúscula)
        let re = Regex::new(r"(\w+)-\n([a-z])").unwrap();
        re.replace_all(text, "$1$2").to_string()
    }

    fn normalize_whitespace(text: &str) -> String {
        // Colapsa espaços múltiplos numa linha, mantém parágrafos (2+ newlines)
        let lines: Vec<String> = text
            .lines()
            .map(|l| {
                let ws = Regex::new(r" {2,}").unwrap();
                ws.replace_all(l.trim(), " ").to_string()
            })
            .collect();
        lines.join("\n")
    }

    /// Remove linhas que aparecem repetidamente (headers/footers de PDF)
    fn remove_repeated_headers_footers(text: &str) -> String {
        let lines: Vec<&str> = text.lines().collect();
        if lines.len() < 10 {
            return text.to_string();
        }

        let mut frequency: HashMap<String, usize> = HashMap::new();
        for line in &lines {
            let norm = line.trim().to_lowercase();
            // Só conta linhas que não são muito curtas nem muito longas
            if norm.len() >= 5 && norm.len() <= 120 {
                *frequency.entry(norm).or_insert(0) += 1;
            }
        }

        // Linhas com 3+ ocorrências são provavelmente header/footer
        let repeated: HashSet<String> = frequency
            .into_iter()
            .filter(|(_, count)| *count >= 3)
            .map(|(line, _)| line)
            .collect();

        lines
            .into_iter()
            .filter(|l| !repeated.contains(&l.trim().to_lowercase()))
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Detecta e substitui tabelas por marcadores `[TABLE_0]`, `[TABLE_1]`, etc.
    fn extract_and_mark_tables(text: String) -> (String, Vec<ExtractedTable>) {
        let mut tables: Vec<ExtractedTable> = Vec::new();
        let mut cleaned = text.clone();

        let lines: Vec<&str> = text.lines().collect();
        let mut i = 0;

        while i < lines.len() {
            if Self::looks_like_table_row(lines[i]) {
                let start = i;
                while i < lines.len() && Self::looks_like_table_row(lines[i]) {
                    i += 1;
                }
                // Tabela precisa ter pelo menos 3 linhas
                if i - start >= 3 {
                    let table_text = lines[start..i].join("\n");
                    let table = Self::parse_table(&table_text);
                    let marker = format!("[TABLE_{}]", tables.len());
                    cleaned = cleaned.replace(&table_text, &marker);
                    tables.push(table);
                }
            }
            i += 1;
        }

        (cleaned, tables)
    }

    fn looks_like_table_row(line: &str) -> bool {
        // 2+ grupos de texto separados por 2+ espaços
        let columns: Vec<&str> = line.split("  ")
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        columns.len() >= 2
    }

    fn parse_table(table_text: &str) -> ExtractedTable {
        let lines: Vec<&str> = table_text.lines().collect();
        let headers: Vec<String> = lines
            .first()
            .map(|h| {
                h.split("  ")
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();

        let rows: Vec<Vec<String>> = lines
            .iter()
            .skip(1) // pula o header
            .map(|line| {
                line.split("  ")
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .filter(|r: &Vec<String>| !r.is_empty())
            .collect();

        ExtractedTable { headers, rows, caption: None }
    }

    fn detect_language(text: &str) -> String {
        // Usa whatlang para detecção de idioma
        let sample = &text[..text.len().min(2000)];
        let info = whatlang::detect(sample);
        match info {
            Some(i) => match i.lang() {
                whatlang::Lang::Por => "pt-BR".into(),
                whatlang::Lang::Eng => "en".into(),
                whatlang::Lang::Spa => "es".into(),
                _ => "pt-BR".into(), // default Brasil
            },
            None => "pt-BR".into(),
        }
    }
}
