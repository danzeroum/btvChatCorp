use uuid::Uuid;
use crate::{Chunk, ChunkType, LegalSection};
use super::cleaner::CleanedText;
use super::extractor::DocumentSection;

#[derive(Debug, Clone)]
pub enum ChunkingStrategy {
    FixedSize { chunk_size: usize, overlap: usize },
    Semantic { max_chunk_size: usize, min_chunk_size: usize, respect_sections: bool },
    Legal { max_clause_size: usize, group_subclauses: bool },
    Sentence { target_size: usize, max_size: usize },
}

pub struct IntelligentChunker;

impl IntelligentChunker {
    pub fn chunk(
        cleaned: &CleanedText,
        strategy: ChunkingStrategy,
        document_id: Uuid,
        workspace_id: Uuid,
    ) -> Vec<Chunk> {
        let mut chunks = match strategy {
            ChunkingStrategy::Semantic { max_chunk_size, min_chunk_size, respect_sections } =>
                Self::chunk_semantic(cleaned, max_chunk_size, min_chunk_size, respect_sections, document_id, workspace_id),
            ChunkingStrategy::Legal { max_clause_size, group_subclauses } =>
                Self::chunk_legal(cleaned, max_clause_size, group_subclauses, document_id, workspace_id),
            ChunkingStrategy::Sentence { target_size, max_size } =>
                Self::chunk_by_sentences(cleaned, target_size, max_size, document_id, workspace_id),
            ChunkingStrategy::FixedSize { chunk_size, overlap } =>
                Self::chunk_fixed(cleaned, chunk_size, overlap, document_id, workspace_id),
        };
        // Encadeia prev/next e preenche totais
        let total = chunks.len() as u32;
        let ids: Vec<Uuid> = chunks.iter().map(|c| c.id).collect();
        for (i, chunk) in chunks.iter_mut().enumerate() {
            chunk.total_chunks = total;
            if i > 0 { chunk.previous_chunk_id = Some(ids[i - 1]); }
            if i + 1 < ids.len() { chunk.next_chunk_id = Some(ids[i + 1]); }
        }
        chunks
    }

    fn chunk_semantic(
        cleaned: &CleanedText, max: usize, min: usize, respect_sections: bool,
        doc_id: Uuid, ws_id: Uuid,
    ) -> Vec<Chunk> {
        let mut chunks = Vec::new();
        let mut idx: u32 = 0;
        if respect_sections && !cleaned.sections.is_empty() {
            for section in &cleaned.sections {
                for (content, chunk_type) in Self::split_section(section, max, min) {
                    chunks.push(Self::make_chunk(&content, idx, doc_id, ws_id, chunk_type, Some(section.title.clone())));
                    idx += 1;
                }
            }
        } else {
            let paragraphs = Self::split_paragraphs(&cleaned.text);
            let mut buffer = String::new();
            for para in paragraphs {
                if buffer.len() + para.len() > max * 5 && buffer.len() >= min * 5 {
                    chunks.push(Self::make_chunk(&buffer, idx, doc_id, ws_id, ChunkType::Paragraph, None));
                    idx += 1;
                    buffer = Self::overlap_prefix(&buffer, 50);
                }
                if !buffer.is_empty() { buffer.push_str("\n\n"); }
                buffer.push_str(&para);
            }
            if buffer.len() >= min * 5 {
                chunks.push(Self::make_chunk(&buffer, idx, doc_id, ws_id, ChunkType::Paragraph, None));
            }
        }
        chunks
    }

    fn chunk_legal(
        cleaned: &CleanedText, max: usize, _group: bool,
        doc_id: Uuid, ws_id: Uuid,
    ) -> Vec<Chunk> {
        let clause_re = regex::Regex::new(
            r"(?m)^(?:CLÁUSULA|Cláusula|Art\.?|Artigo)\s*(\d+[.\d]*)"
        ).unwrap();
        let text = &cleaned.text;
        let positions: Vec<(usize, String)> = clause_re
            .find_iter(text)
            .map(|m| (m.start(), m.as_str().to_string()))
            .collect();
        if positions.is_empty() {
            return Self::chunk_semantic(cleaned, max, 50, true, doc_id, ws_id);
        }
        let mut chunks = Vec::new();
        let mut idx: u32 = 0;
        for (i, (start, title)) in positions.iter().enumerate() {
            let end = if i + 1 < positions.len() { positions[i + 1].0 } else { text.len() };
            let content = text[*start..end].trim().to_string();
            let chunk_type = ChunkType::Legal(Self::classify_clause(&content));
            chunks.push(Self::make_chunk(&content, idx, doc_id, ws_id, chunk_type, Some(title.clone())));
            idx += 1;
        }
        chunks
    }

    fn chunk_by_sentences(
        cleaned: &CleanedText, target: usize, max: usize,
        doc_id: Uuid, ws_id: Uuid,
    ) -> Vec<Chunk> {
        let sentences = Self::split_sentences(&cleaned.text);
        let mut chunks = Vec::new();
        let mut buffer = String::new();
        let mut idx: u32 = 0;
        for sent in sentences {
            if buffer.len() + sent.len() > max * 5 {
                chunks.push(Self::make_chunk(&buffer, idx, doc_id, ws_id, ChunkType::Paragraph, None));
                idx += 1;
                buffer = String::new();
            }
            buffer.push_str(&sent);
            buffer.push(' ');
        }
        if !buffer.is_empty() {
            chunks.push(Self::make_chunk(&buffer, idx, doc_id, ws_id, ChunkType::Paragraph, None));
        }
        chunks
    }

    fn chunk_fixed(
        cleaned: &CleanedText, size: usize, overlap: usize,
        doc_id: Uuid, ws_id: Uuid,
    ) -> Vec<Chunk> {
        let words: Vec<&str> = cleaned.text.split_whitespace().collect();
        let step = size.saturating_sub(overlap);
        let mut chunks = Vec::new();
        let mut idx: u32 = 0;
        let mut i = 0;
        while i < words.len() {
            let slice = words[i..std::cmp::min(i + size, words.len())].join(" ");
            chunks.push(Self::make_chunk(&slice, idx, doc_id, ws_id, ChunkType::Paragraph, None));
            idx += 1;
            i += step;
        }
        chunks
    }

    fn split_section(section: &DocumentSection, max: usize, min: usize) -> Vec<(String, ChunkType)> {
        if section.content.len() <= max * 5 {
            let content = format!("## {}\n\n{}", section.title, section.content.trim());
            return vec![(content, ChunkType::Paragraph)];
        }
        let sentences = Self::split_sentences(&section.content);
        let mut result = Vec::new();
        let mut buffer = format!("## {} (continuação)\n\n", section.title);
        for sent in sentences {
            if buffer.len() + sent.len() > max * 5 && buffer.len() >= min * 5 {
                result.push((buffer.clone(), ChunkType::Paragraph));
                buffer = format!("## {} (continuação)\n\n", section.title);
            }
            buffer.push_str(&sent);
            buffer.push(' ');
        }
        if !buffer.is_empty() { result.push((buffer, ChunkType::Paragraph)); }
        result
    }

    fn classify_clause(text: &str) -> LegalSection {
        let lower = text.to_lowercase();
        if ["multa", "penalidade", "rescisão"].iter().any(|k| lower.contains(k)) {
            return LegalSection::Penalty;
        }
        if ["obriga-se", "deverá", "responsabilidade"].iter().any(|k| lower.contains(k)) {
            return LegalSection::Obligation;
        }
        if ["define-se", "entende-se por", "glossário"].iter().any(|k| lower.contains(k)) {
            return LegalSection::Definition;
        }
        LegalSection::Clause
    }

    fn split_sentences(text: &str) -> Vec<String> {
        let re = regex::Regex::new(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚZ])").unwrap();
        re.split(text).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
    }

    fn split_paragraphs(text: &str) -> Vec<String> {
        text.split("\n\n")
            .map(|p| p.trim().to_string())
            .filter(|p| p.len() > 10)
            .collect()
    }

    fn overlap_prefix(text: &str, _overlap_tokens: usize) -> String {
        let sentences = Self::split_sentences(text);
        if let Some(last) = sentences.last() {
            format!("[...] {}\n\n", last.trim())
        } else {
            String::new()
        }
    }

    fn make_chunk(
        content: &str, index: u32, doc_id: Uuid, ws_id: Uuid,
        chunk_type: ChunkType, section_title: Option<String>,
    ) -> Chunk {
        Chunk {
            id: Uuid::new_v4(),
            document_id: doc_id,
            workspace_id: ws_id,
            content: content.to_string(),
            chunk_index: index,
            total_chunks: 0,
            section_title,
            page_number: None,
            chunk_type,
            token_count: content.split_whitespace().count() as u32,
            previous_chunk_id: None,
            next_chunk_id: None,
            embedding: None,
        }
    }
}
