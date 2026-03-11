use regex::Regex;
use uuid::Uuid;

use crate::{
    cleaner::CleanedText,
    extractor::TextExtractor,
    Chunk, ChunkType, DocumentSection, LegalSection, SectionType,
};

// ─── Estratégias de chunking ───────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub enum ChunkingStrategy {
    /// Tamanho fixo com overlap. Fallback genérico.
    FixedSize { chunk_size: usize, overlap: usize },
    /// Respeitando estrutura do documento (recomendado como default)
    Semantic { max_chunk_size: usize, min_chunk_size: usize, respect_sections: bool },
    /// Por sentenças agrupadas até o limite
    Sentence { target_size: usize, max_size: usize },
    /// Jurídico: cada cláusula = 1 chunk
    Legal { max_clause_size: usize, group_subclauses: bool },
    /// Médico: cada seção clínica = 1 chunk
    Medical { max_section_size: usize, include_patient_context: bool },
    /// Cada tabela vira um chunk
    Table,
}

// ─── Tokenizador simples (word-based) ──────────────────────────────────────────────────

/// Estimativa simples de tokens: palavras / 0.75 (aprox. BPE)
pub struct SimpleTokenizer;

impl SimpleTokenizer {
    pub fn count_tokens(text: &str) -> usize {
        let words = text.split_whitespace().count();
        // ~0.75 tokens por palavra (estimativa para texto PT-BR)
        ((words as f64) / 0.75).ceil() as usize
    }
}

// ─── Chunker principal ────────────────────────────────────────────────────────────────

pub struct IntelligentChunker;

impl IntelligentChunker {
    /// Ponto de entrada: escolhe estratégia e executa
    pub fn chunk(
        cleaned: CleanedText,
        strategy: ChunkingStrategy,
        document_id: Uuid,
        workspace_id: Uuid,
    ) -> Vec<Chunk> {
        let mut chunks = match strategy {
            ChunkingStrategy::Semantic { max_chunk_size, min_chunk_size, respect_sections } =>
                Self::chunk_semantic(&cleaned, max_chunk_size, min_chunk_size, respect_sections, document_id, workspace_id),
            ChunkingStrategy::Legal { max_clause_size, group_subclauses } =>
                Self::chunk_legal(&cleaned, max_clause_size, group_subclauses, document_id, workspace_id),
            ChunkingStrategy::Sentence { target_size, max_size } =>
                Self::chunk_by_sentences(&cleaned, target_size, max_size, document_id, workspace_id),
            ChunkingStrategy::FixedSize { chunk_size, overlap } =>
                Self::chunk_fixed(&cleaned, chunk_size, overlap, document_id, workspace_id),
            ChunkingStrategy::Medical { max_section_size, include_patient_context } =>
                Self::chunk_medical(&cleaned, max_section_size, include_patient_context, document_id, workspace_id),
            ChunkingStrategy::Table =>
                Self::chunk_tables(&cleaned, document_id, workspace_id),
        };

        // Preenche total_chunks e encadeia prev/next
        let total = chunks.len() as u32;
        for (i, chunk) in chunks.iter_mut().enumerate() {
            chunk.total_chunks = total;
            chunk.token_count = SimpleTokenizer::count_tokens(&chunk.content) as u32;
            if i > 0 {
                chunk.previous_chunk_id = Some(chunks[i - 1].id);
            }
        }
        // next_chunk_id em segunda passagem para evitar borrow conflicts
        let ids: Vec<Uuid> = chunks.iter().map(|c| c.id).collect();
        for (i, chunk) in chunks.iter_mut().enumerate() {
            if i + 1 < ids.len() {
                chunk.next_chunk_id = Some(ids[i + 1]);
            }
        }
        chunks
    }

    // ─── Estratégia 1: Semântica (default) ──────────────────────────────────────────

    fn chunk_semantic(
        cleaned: &CleanedText,
        max_size: usize,
        min_size: usize,
        respect_sections: bool,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        let mut chunks: Vec<Chunk> = Vec::new();
        let mut chunk_index = 0u32;

        if respect_sections && !cleaned.sections.is_empty() {
            // Divide respeitando as seções do documento
            for section in &cleaned.sections {
                let sub = Self::split_section_into_chunks(section, max_size, min_size);
                for (content, chunk_type) in sub {
                    chunks.push(Self::make_chunk(
                        &content, chunk_index, doc_id, ws_id,
                        chunk_type, Some(section.title.clone()),
                    ));
                    chunk_index += 1;
                }
            }
        } else {
            // Sem estrutura: divide por parágrafos agrupados
            let paragraphs = Self::split_into_paragraphs(&cleaned.text);
            let mut buffer = String::new();
            let mut buffer_tokens = 0usize;

            for para in &paragraphs {
                let para_tokens = SimpleTokenizer::count_tokens(para);

                if para_tokens > max_size {
                    // Salva buffer atual
                    if !buffer.is_empty() && buffer_tokens >= min_size {
                        chunks.push(Self::make_chunk(&buffer, chunk_index, doc_id, ws_id, ChunkType::Paragraph, None));
                        chunk_index += 1;
                        buffer.clear();
                        buffer_tokens = 0;
                    }
                    // Divide parágrafo grande por sentenças
                    for sub in Self::split_large_paragraph(para, max_size) {
                        chunks.push(Self::make_chunk(&sub, chunk_index, doc_id, ws_id, ChunkType::Paragraph, None));
                        chunk_index += 1;
                    }
                    continue;
                }

                if buffer_tokens + para_tokens > max_size {
                    // Salva buffer
                    if buffer_tokens >= min_size {
                        chunks.push(Self::make_chunk(&buffer, chunk_index, doc_id, ws_id, ChunkType::Paragraph, None));
                        chunk_index += 1;
                    }
                    // Overlap: pega últimas 50 tokens do buffer anterior
                    buffer = Self::create_overlap_prefix(&buffer, 50);
                    buffer_tokens = SimpleTokenizer::count_tokens(&buffer);
                }

                if !buffer.is_empty() { buffer.push('\n'); }
                buffer.push_str(para);
                buffer_tokens += para_tokens;
            }

            // Flush buffer final
            if buffer_tokens >= min_size {
                chunks.push(Self::make_chunk(&buffer, chunk_index, doc_id, ws_id, ChunkType::Paragraph, None));
            } else if !buffer.is_empty() && !chunks.is_empty() {
                // Muito pequeno: anexa ao último chunk
                if let Some(last) = chunks.last_mut() {
                    last.content.push('\n');
                    last.content.push_str(&buffer);
                }
            }
        }
        chunks
    }

    // ─── Estratégia 2: Jurídico ─────────────────────────────────────────────────────

    fn chunk_legal(
        cleaned: &CleanedText,
        max_clause_size: usize,
        group_subclauses: bool,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        let text = &cleaned.text;
        let clause_re = Regex::new(r"(?im)(?:CL[AÁ]USULA|Cláusula|Art\.?|Artigo)\s*[\d\.]+[\s\-–]*[A-Z]").unwrap();

        let clause_positions: Vec<(usize, String)> = clause_re
            .find_iter(text)
            .map(|m| (m.start(), m.as_str().to_string()))
            .collect();

        // Fallback para semântico se não detectar cláusulas
        if clause_positions.is_empty() {
            return Self::chunk_semantic(
                cleaned, max_clause_size, 50, true, doc_id, ws_id,
            );
        }

        let mut chunks: Vec<Chunk> = Vec::new();
        let mut chunk_index = 0u32;

        for (i, (start, clause_title)) in clause_positions.iter().enumerate() {
            let end = if i + 1 < clause_positions.len() {
                clause_positions[i + 1].0
            } else {
                text.len()
            };

            let clause_text = text[*start..end].trim().to_string();
            let tokens = SimpleTokenizer::count_tokens(&clause_text);
            let chunk_type = ChunkType::Legal(Self::classify_legal_clause(&clause_text));

            if tokens <= max_clause_size {
                chunks.push(Self::make_chunk(
                    &clause_text, chunk_index, doc_id, ws_id,
                    chunk_type, Some(clause_title.clone()),
                ));
                chunk_index += 1;
            } else {
                // Cláusula grande: divide por sub-cláusulas ou sentenças
                let sub_chunks = if group_subclauses {
                    Self::split_clause_by_subclauses(&clause_text, &clause_title, max_clause_size)
                } else {
                    Self::split_large_paragraph(&clause_text, max_clause_size)
                        .into_iter()
                        .map(|c| (c, clause_title.clone()))
                        .collect()
                };
                let chunk_type_clone = ChunkType::Legal(Self::classify_legal_clause(&clause_text));
                for (content, title) in sub_chunks {
                    chunks.push(Self::make_chunk(
                        &content, chunk_index, doc_id, ws_id,
                        chunk_type_clone.clone(), Some(title),
                    ));
                    chunk_index += 1;
                }
            }
        }
        chunks
    }

    fn classify_legal_clause(text: &str) -> LegalSection {
        let lower = text.to_lowercase();
        let penalties = ["multa", "penalidade", "rescisão", "inadimplemento", "indenização", "mora"];
        let obligations = ["obriga-se", "dever", "compromete-se", "incumbe", "responsabilidade"];
        let definitions = ["define-se", "entende-se por", "para os fins", "glossário", "definições"];

        if penalties.iter().any(|k| lower.contains(k)) { return LegalSection::Penalty; }
        if obligations.iter().any(|k| lower.contains(k)) { return LegalSection::Obligation; }
        if definitions.iter().any(|k| lower.contains(k)) { return LegalSection::Definition; }
        LegalSection::GeneralProvision
    }

    fn split_clause_by_subclauses(
        text: &str,
        title: &str,
        max_size: usize,
    ) -> Vec<(String, String)> {
        // Sub-cláusulas: parágrafo, §, N.M
        let sub_re = Regex::new(r"(?m)^\s*(?:§|Parágrafo|\d+\.\d+)").unwrap();
        let positions: Vec<usize> = sub_re.find_iter(text).map(|m| m.start()).collect();

        if positions.is_empty() {
            return Self::split_large_paragraph(text, max_size)
                .into_iter()
                .map(|c| (c, title.to_string()))
                .collect();
        }

        let mut result: Vec<(String, String)> = Vec::new();
        let mut buffer = String::new();
        let mut buffer_tokens = 0usize;

        for (i, &start) in positions.iter().enumerate() {
            let end = if i + 1 < positions.len() { positions[i + 1] } else { text.len() };
            let sub_text = text[start..end].trim().to_string();
            let tokens = SimpleTokenizer::count_tokens(&sub_text);

            if buffer_tokens + tokens > max_size && !buffer.is_empty() {
                result.push((buffer.clone(), title.to_string()));
                buffer.clear();
                buffer_tokens = 0;
            }
            if !buffer.is_empty() { buffer.push('\n'); }
            buffer.push_str(&sub_text);
            buffer_tokens += tokens;
        }
        if !buffer.is_empty() {
            result.push((buffer, title.to_string()));
        }
        result
    }

    // ─── Estratégia 3: Por sentenças ─────────────────────────────────────────────────────

    fn chunk_by_sentences(
        cleaned: &CleanedText,
        target_size: usize,
        max_size: usize,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        let sentences = Self::split_into_sentences(&cleaned.text);
        let mut chunks: Vec<Chunk> = Vec::new();
        let mut chunk_index = 0u32;
        let mut buffer = String::new();
        let mut buffer_tokens = 0usize;

        for sent in sentences {
            let sent_tokens = SimpleTokenizer::count_tokens(&sent);
            if buffer_tokens + sent_tokens > max_size && buffer_tokens >= target_size / 2 {
                chunks.push(Self::make_chunk(&buffer, chunk_index, doc_id, ws_id, ChunkType::Paragraph, None));
                chunk_index += 1;
                buffer = Self::create_overlap_prefix(&buffer, 30);
                buffer_tokens = SimpleTokenizer::count_tokens(&buffer);
            }
            if !buffer.is_empty() { buffer.push(' '); }
            buffer.push_str(&sent);
            buffer_tokens += sent_tokens;
        }
        if !buffer.is_empty() {
            chunks.push(Self::make_chunk(&buffer, chunk_index, doc_id, ws_id, ChunkType::Paragraph, None));
        }
        chunks
    }

    // ─── Estratégia 4: Tamanho fixo ─────────────────────────────────────────────────────

    fn chunk_fixed(
        cleaned: &CleanedText,
        chunk_size: usize,
        overlap: usize,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        let words: Vec<&str> = cleaned.text.split_whitespace().collect();
        let step = if overlap < chunk_size { chunk_size - overlap } else { chunk_size };
        let mut chunks: Vec<Chunk> = Vec::new();
        let mut chunk_index = 0u32;
        let mut start = 0usize;

        while start < words.len() {
            let end = (start + chunk_size).min(words.len());
            let content = words[start..end].join(" ");
            chunks.push(Self::make_chunk(&content, chunk_index, doc_id, ws_id, ChunkType::Paragraph, None));
            chunk_index += 1;
            if end == words.len() { break; }
            start += step;
        }
        chunks
    }

    // ─── Estratégia 5: Médico ───────────────────────────────────────────────────────────

    fn chunk_medical(
        cleaned: &CleanedText,
        max_section_size: usize,
        include_patient_context: bool,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        // Extrai contexto do paciente (linhas iniciais com nome, data, CID-10, etc.)
        let patient_context = if include_patient_context {
            cleaned.text
                .lines()
                .take(5)
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            String::new()
        };

        let mut chunks: Vec<Chunk> = Vec::new();
        let mut chunk_index = 0u32;

        if !cleaned.sections.is_empty() {
            for section in &cleaned.sections {
                // Injeta contexto do paciente em cada chunk médico
                let content = if include_patient_context && !patient_context.is_empty() {
                    format!("[Contexto do paciente]\n{}\n---\n{}", patient_context, section.content.trim())
                } else {
                    section.content.clone()
                };

                // Divide seção se maior que o limite
                for sub_content in Self::split_large_paragraph(&content, max_section_size) {
                    let chunk_type = match &section.section_type {
                        SectionType::Medical(ms) => ChunkType::Medical(ms.clone()),
                        _ => ChunkType::Paragraph,
                    };
                    chunks.push(Self::make_chunk(
                        &sub_content, chunk_index, doc_id, ws_id,
                        chunk_type, Some(section.title.clone()),
                    ));
                    chunk_index += 1;
                }
            }
        } else {
            // Fallback
            return Self::chunk_semantic(cleaned, max_section_size, 100, false, doc_id, ws_id);
        }
        chunks
    }

    // ─── Estratégia 6: Tabelas ──────────────────────────────────────────────────────────

    fn chunk_tables(cleaned: &CleanedText, doc_id: Uuid, ws_id: Uuid) -> Vec<Chunk> {
        let mut chunks: Vec<Chunk> = Vec::new();
        let mut chunk_index = 0u32;

        for table in &cleaned.tables {
            let mut content = String::new();
            if !table.headers.is_empty() {
                content.push_str(&table.headers.join(" | "));
                content.push('\n');
                content.push_str(&"-".repeat(40));
                content.push('\n');
            }
            for row in &table.rows {
                content.push_str(&row.join(" | "));
                content.push('\n');
            }
            chunks.push(Self::make_chunk(&content, chunk_index, doc_id, ws_id, ChunkType::Table, None));
            chunk_index += 1;
        }

        // Também adiciona o texto não-tabular como chunks semânticos
        let text_only = CleanedText {
            text: cleaned.text.clone(),
            tables: vec![],
            language: cleaned.language.clone(),
            sections: cleaned.sections.clone(),
        };
        let text_chunks = Self::chunk_semantic(&text_only, 512, 100, true, doc_id, ws_id);
        chunks.extend(text_chunks);
        chunks
    }

    // ─── Utilitários ──────────────────────────────────────────────────────────────────

    fn split_section_into_chunks(
        section: &DocumentSection,
        max_size: usize,
        min_size: usize,
    ) -> Vec<(String, ChunkType)> {
        let tokens = SimpleTokenizer::count_tokens(&section.content);
        let chunk_type = Self::section_type_to_chunk_type(&section.section_type);

        if tokens <= max_size {
            let content = format!("{}\n{}", section.title, section.content.trim());
            return vec![(content, chunk_type)];
        }

        // Seção grande: divide por sentenças
        let sentences = Self::split_into_sentences(&section.content);
        let mut result: Vec<(String, ChunkType)> = Vec::new();
        let mut buffer = format!("{} (continuação)\n", section.title);
        let mut buffer_tokens = SimpleTokenizer::count_tokens(&buffer);
        let mut is_first = true;

        for sent in sentences {
            let sent_tokens = SimpleTokenizer::count_tokens(&sent);
            if buffer_tokens + sent_tokens > max_size && buffer_tokens >= min_size {
                result.push((buffer.clone(), chunk_type.clone()));
                buffer = format!("{} (continuação)\n", section.title);
                buffer_tokens = SimpleTokenizer::count_tokens(&buffer);
                is_first = false;
            }
            buffer.push_str(&sent);
            buffer.push(' ');
            buffer_tokens += sent_tokens;
        }
        if buffer_tokens >= min_size || is_first {
            result.push((buffer, chunk_type));
        }
        result
    }

    fn section_type_to_chunk_type(st: &SectionType) -> ChunkType {
        match st {
            SectionType::Legal(ls) => ChunkType::Legal(ls.clone()),
            SectionType::Medical(ms) => ChunkType::Medical(ms.clone()),
            SectionType::Generic => ChunkType::Paragraph,
        }
    }

    /// Divide texto em sentenças (PT-BR aware: não quebra em Dr., Art., nº, etc.)
    pub fn split_into_sentences(text: &str) -> Vec<String> {
        // Evita quebrar em abreviaturas comuns
        let re = Regex::new(r"(?<![DrSrSraArtnIncLtdLtda])\.(?=\s+[A-Z])|[!?](?=\s)").unwrap();
        let mut sentences: Vec<String> = Vec::new();
        let mut last = 0usize;
        for m in re.find_iter(text) {
            let end = m.end();
            let sent = text[last..end].trim().to_string();
            if !sent.is_empty() {
                sentences.push(sent);
            }
            last = end;
        }
        if last < text.len() {
            let remainder = text[last..].trim().to_string();
            if !remainder.is_empty() {
                sentences.push(remainder);
            }
        }
        sentences
    }

    /// Divide texto em parágrafos (2+ quebras de linha)
    pub fn split_into_paragraphs(text: &str) -> Vec<String> {
        text.split("\n\n")
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty() && p.len() >= 10)
            .collect()
    }

    /// Divide parágrafo grande por sentenças agrupadas até max_size tokens
    pub fn split_large_paragraph(text: &str, max_size: usize) -> Vec<String> {
        let sentences = Self::split_into_sentences(text);
        let mut result: Vec<String> = Vec::new();
        let mut buffer = String::new();
        let mut buf_tokens = 0usize;

        for sent in sentences {
            let st = SimpleTokenizer::count_tokens(&sent);
            if buf_tokens + st > max_size && !buffer.is_empty() {
                result.push(buffer.trim().to_string());
                buffer.clear();
                buf_tokens = 0;
            }
            buffer.push_str(&sent);
            buffer.push(' ');
            buf_tokens += st;
        }
        if !buffer.trim().is_empty() {
            result.push(buffer.trim().to_string());
        }
        result
    }

    /// Cria prefixo de overlap: pega as últimas `overlap_tokens` tokens do chunk anterior
    pub fn create_overlap_prefix(previous: &str, overlap_tokens: usize) -> String {
        let sentences = Self::split_into_sentences(previous);
        let mut prefix = String::new();
        let mut tokens = 0usize;

        for sent in sentences.iter().rev() {
            let st = SimpleTokenizer::count_tokens(sent);
            if tokens + st > overlap_tokens { break; }
            prefix = format!("{} {}", sent, prefix);
            tokens += st;
        }
        if !prefix.is_empty() {
            format!("...{}\n", prefix.trim())
        } else {
            String::new()
        }
    }

    pub fn make_chunk(
        content: &str,
        index: u32,
        doc_id: Uuid,
        ws_id: Uuid,
        chunk_type: ChunkType,
        section_title: Option<String>,
    ) -> Chunk {
        Chunk {
            id: Uuid::new_v4(),
            document_id: doc_id,
            workspace_id: ws_id,
            content: content.to_string(),
            chunk_index: index,
            total_chunks: 0,  // preenchido depois
            section_title,
            page_number: None,
            chunk_type,
            token_count: 0,   // preenchido depois
            previous_chunk_id: None,
            next_chunk_id: None,
            embedding: None,
        }
    }
}
