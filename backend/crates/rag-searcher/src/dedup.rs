use crate::searcher::RetrievedChunk;
use std::collections::HashSet;

/// Remove chunks redundantes do resultado final:
/// - Mesma seção do mesmo documento já representada
/// - Chunks com conteúdo muito similar (sobreposição > 80%)
pub fn deduplicate(chunks: Vec<RetrievedChunk>) -> Vec<RetrievedChunk> {
    let mut seen_sections: HashSet<String> = HashSet::new();
    let mut result: Vec<RetrievedChunk> = Vec::new();

    for chunk in chunks {
        // Chave de dedup: document_id + section_title
        let key = format!(
            "{}::{}",
            chunk.document_id,
            chunk.section_title.as_deref().unwrap_or("__none__")
        );

        if seen_sections.contains(&key) {
            continue;
        }

        // Verifica sobreposição de conteúdo com chunks já incluídos
        if is_too_similar(&chunk.content, &result) {
            continue;
        }

        seen_sections.insert(key);
        result.push(chunk);
    }
    result
}

/// Verifica se o conteúdo tem sobreposição alta (> 80%) com algum chunk já aceito.
/// Usa heurística de bigrams para eficiência.
fn is_too_similar(content: &str, existing: &[RetrievedChunk]) -> bool {
    let candidate_bigrams = bigrams(content);
    if candidate_bigrams.is_empty() {
        return false;
    }

    for existing_chunk in existing {
        let existing_bigrams = bigrams(&existing_chunk.content);
        if existing_bigrams.is_empty() {
            continue;
        }

        let intersection = candidate_bigrams
            .iter()
            .filter(|b| existing_bigrams.contains(b))
            .count();

        let overlap = intersection as f64
            / candidate_bigrams.len().min(existing_bigrams.len()) as f64;

        if overlap > 0.8 {
            return true;
        }
    }
    false
}

/// Gera bigrams de palavras de um texto
fn bigrams(text: &str) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().take(200).collect();
    words
        .windows(2)
        .map(|w| format!("{} {}", w[0], w[1]))
        .collect()
}
