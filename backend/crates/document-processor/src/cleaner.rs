use super::extractor::ExtractedDocument;
use std::collections::HashMap;

pub struct CleanedText {
    pub text: String,
    pub language: String,
    pub sections: Vec<super::extractor::DocumentSection>,
}

pub struct TextCleaner;

impl TextCleaner {
    pub fn clean(extracted: &ExtractedDocument) -> CleanedText {
        let mut text = extracted.raw_text.clone();
        text = Self::remove_pdf_artifacts(&text);
        text = Self::fix_hyphenation(&text);
        text = Self::normalize_whitespace(&text);
        text = Self::remove_repeated_headers_footers(&text);
        let language = Self::detect_language(&text);
        CleanedText { text, language, sections: extracted.sections.clone() }
    }

    fn remove_pdf_artifacts(text: &str) -> String {
        text.replace("\x0C", "\n")  // Form feed
            .replace("\u{FFFD}", "")   // Replacement char
    }

    fn fix_hyphenation(text: &str) -> String {
        let re = regex::Regex::new(r"(\w+)-\s*\n\s*([a-záéíóúàâêôãõç])").unwrap();
        re.replace_all(text, "$1$2").to_string()
    }

    fn normalize_whitespace(text: &str) -> String {
        let re = regex::Regex::new(r"[ \t]{3,}").unwrap();
        re.replace_all(text, "  ").to_string()
    }

    fn remove_repeated_headers_footers(text: &str) -> String {
        let lines: Vec<&str> = text.lines().collect();
        let mut freq: HashMap<String, usize> = HashMap::new();
        for line in &lines {
            let norm = line.trim().to_lowercase();
            if norm.len() > 5 && norm.len() < 100 {
                *freq.entry(norm).or_insert(0) += 1;
            }
        }
        let repeated: std::collections::HashSet<String> = freq
            .into_iter()
            .filter(|(_, c)| *c > 3)
            .map(|(l, _)| l)
            .collect();
        lines.into_iter()
            .filter(|l| !repeated.contains(&l.trim().to_lowercase()))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn detect_language(text: &str) -> String {
        // Heurística simples: palavras comuns em PT-BR
        let pt_words = ["que", "com", "para", "por", "uma", "dos", "das", "não", "são"];
        let pt_count = pt_words.iter().filter(|w| text.to_lowercase().contains(*w)).count();
        if pt_count >= 3 { "pt-BR".to_string() } else { "en".to_string() }
    }
}
