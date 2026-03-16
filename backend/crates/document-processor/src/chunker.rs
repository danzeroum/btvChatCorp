use uuid::Uuid;
use crate::models::{Chunk, ChunkType, ExtractedDocument};
use crate::strategy::ChunkingStrategy;

// ---------------------------------------------------------------------------
// Tokenizer simples baseado em whitespace (aprox. 1 token = 4 chars)
// Para produção, trocar por tiktoken ou sentencepiece
// ---------------------------------------------------------------------------
struct SimpleTokenizer;
impl SimpleTokenizer {
    fn count_tokens(text: &str) -> usize {
        (text.len() as f32 / 4.0).ceil() as usize
    }
}

pub struct IntelligentChunker;

impl IntelligentChunker {
    /// Ponto de entrada: seleciona a estratégia e executa
    pub fn chunk(
        cleaned: &ExtractedDocument,
        strategy: ChunkingStrategy,
        document_id: Uuid,
        workspace_id: Uuid,
    ) -> Vec<Chunk> {
        let mut chunks = match strategy {
            ChunkingStrategy::Semantic { max_chunk_size, min_chunk_size, respect_sections } =>
                Self::chunk_semantic(cleaned, max_chunk_size, min_chunk_size, respect_sections, document_id, workspace_id),
            ChunkingStrategy::Legal { max_clause_size, group_sub_clauses } =>
                Self::chunk_legal(cleaned, max_clause_size, group_sub_clauses, document_id, workspace_id),
            ChunkingStrategy::Sentence { target_size, max_size } =>
                Self::chunk_by_sentences(cleaned, target_size, max_size, document_id, workspace_id),
            ChunkingStrategy::FixedSize { chunk_size, overlap } =>
                Self::chunk_fixed(cleaned, chunk_size, overlap, document_id, workspace_id),
            ChunkingStrategy::Medical { max_section_size, .. } =>
                Self::chunk_semantic(cleaned, max_section_size, 50, true, document_id, workspace_id),
            ChunkingStrategy::Table =>
                Self::chunk_by_tables(cleaned, document_id, workspace_id),
        };

        // Preenche total_chunks, token_count e encadeia prev/next
        let total = chunks.len() as u32;
        for (i, chunk) in chunks.iter_mut().enumerate() {
            chunk.total_chunks = total;
            chunk.token_count = SimpleTokenizer::count_tokens(&chunk.content) as u32;
            if i > 0 { chunk.previous_chunk_id = Some(chunks[i - 1].id); }
        }
        // next_chunk_id (segunda passagem para evitar borrow mut conflict)
        let ids: Vec<Uuid> = chunks.iter().map(|c| c.id).collect();
        for (i, chunk) in chunks.iter_mut().enumerate() {
            if i + 1 < ids.len() {
                chunk.next_chunk_id = Some(ids[i + 1]);
            }
        }
        chunks
    }

    // -----------------------------------------------------------------------
    // Estratégia 1 — Semântica (padrão)
    // -----------------------------------------------------------------------
    fn chunk_semantic(
        doc: &ExtractedDocument,
        max_size: usize,
        min_size: usize,
        respect_sections: bool,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        let mut chunks = Vec::new();
        let mut index = 0u32;

        if respect_sections && !doc.sections.is_empty() {
            for section in &doc.sections {
                let tokens = SimpleTokenizer::count_tokens(&section.content);
                if tokens <= max_size {
                    // Seção inteira cabe num chunk
                    let content = format!("{}: {}", section.title, section.content.trim());
                    chunks.push(Self::make_chunk(
                        &content, index, doc_id, ws_id,
                        ChunkType::Paragraph, Some(section.title.clone()),
                    ));
                    index += 1;
                } else {
                    // Divide por parágrafos
                    let sub = Self::split_by_paragraphs(
                        &section.content, max_size, min_size,
                        doc_id, ws_id, &mut index,
                        Some(section.title.clone()),
                    );
                    chunks.extend(sub);
                }
            }
        } else {
            let sub = Self::split_by_paragraphs(
                &doc.raw_text, max_size, min_size,
                doc_id, ws_id, &mut index, None,
            );
            chunks.extend(sub);
        }
        chunks
    }

    fn split_by_paragraphs(
        text: &str,
        max_size: usize,
        min_size: usize,
        doc_id: Uuid,
        ws_id: Uuid,
        index: &mut u32,
        section_title: Option<String>,
    ) -> Vec<Chunk> {
        let mut chunks = Vec::new();
        let mut buffer = String::new();
        let mut buffer_tokens = 0usize;

        let paragraphs: Vec<&str> = text
            .split("\n\n")
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .collect();

        for para in &paragraphs {
            let para_tokens = SimpleTokenizer::count_tokens(para);

            if para_tokens >= max_size {
                // Salva buffer atual
                if buffer_tokens >= min_size {
                    chunks.push(Self::make_chunk(
                        &buffer, *index, doc_id, ws_id,
                        ChunkType::Paragraph, section_title.clone(),
                    ));
                    *index += 1;
                }
                buffer.clear();
                buffer_tokens = 0;
                // Divide parágrafo grande por sentenças
                let subs = Self::split_large_paragraph(para, max_size);
                for sub in subs {
                    chunks.push(Self::make_chunk(
                        &sub, *index, doc_id, ws_id,
                        ChunkType::Paragraph, section_title.clone(),
                    ));
                    *index += 1;
                }
                continue;
            }

            if buffer_tokens + para_tokens > max_size {
                if buffer_tokens >= min_size {
                    chunks.push(Self::make_chunk(
                        &buffer, *index, doc_id, ws_id,
                        ChunkType::Paragraph, section_title.clone(),
                    ));
                    *index += 1;
                    buffer = Self::create_overlap_prefix(&buffer, 50);
                    buffer_tokens = SimpleTokenizer::count_tokens(&buffer);
                }
            }

            if !buffer.is_empty() { buffer.push('\n'); buffer.push('\n'); }
            buffer.push_str(para);
            buffer_tokens += para_tokens;
        }

        // Último buffer
        if buffer_tokens >= min_size {
            chunks.push(Self::make_chunk(
                &buffer, *index, doc_id, ws_id,
                ChunkType::Paragraph, section_title,
            ));
            *index += 1;
        } else if !buffer.is_empty() && !chunks.is_empty() {
            // Muito pequeno: anexa ao último chunk
            if let Some(last) = chunks.last_mut() {
                last.content.push_str(" ");
                last.content.push_str(&buffer);
            }
        }
        chunks
    }

    fn split_large_paragraph(text: &str, max_size: usize) -> Vec<String> {
        let mut result = Vec::new();
        let mut buf = String::new();
        let mut buf_tokens = 0usize;
        for sentence in text.split(|c| c == '.' || c == '!' || c == '?') {
            let s = sentence.trim();
            if s.is_empty() { continue; }
            let t = SimpleTokenizer::count_tokens(s);
            if buf_tokens + t > max_size {
                if !buf.is_empty() { result.push(buf.trim().to_string()); }
                buf = s.to_string();
                buf_tokens = t;
            } else {
                if !buf.is_empty() { buf.push_str(". "); }
                buf.push_str(s);
                buf_tokens += t;
            }
        }
        if !buf.is_empty() { result.push(buf.trim().to_string()); }
        result
    }

    fn create_overlap_prefix(text: &str, overlap_tokens: usize) -> String {
        // Pega as últimas `overlap_tokens` palavras aproximadas
        let words: Vec<&str> = text.split_whitespace().collect();
        let take = overlap_tokens.min(words.len());
        if take == 0 { return String::new(); }
        words[words.len() - take..].join(" ")
    }

    // -----------------------------------------------------------------------
    // Estratégia 2 — Jurídica
    // -----------------------------------------------------------------------
    fn chunk_legal(
        doc: &ExtractedDocument,
        max_clause_size: usize,
        _group_sub_clauses: bool,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        let re = regex::Regex::new(
            r"(?im)^(cláusula\s+\w+|art\.?\s*\d+[\u00ba\u00aa]?|artigo\s+\d+)"
        ).unwrap();

        let text = &doc.raw_text;
        let positions: Vec<(usize, String)> = re
            .find_iter(text)
            .map(|m| (m.start(), m.as_str().to_string()))
            .collect();

        if positions.is_empty() {
            return Self::chunk_semantic(doc, max_clause_size, 50, true, doc_id, ws_id);
        }

        let mut chunks = Vec::new();
        let mut index = 0u32;

        for (i, (start, title)) in positions.iter().enumerate() {
            let end = if i + 1 < positions.len() { positions[i + 1].0 } else { text.len() };
            let clause_text = text[*start..end].trim();
            let tokens = SimpleTokenizer::count_tokens(clause_text);

            if tokens <= max_clause_size {
                chunks.push(Self::make_chunk(
                    clause_text, index, doc_id, ws_id,
                    ChunkType::LegalClause, Some(title.clone()),
                ));
                index += 1;
            } else {
                // Divide cláusula grande por parágrafos
                let subs = Self::split_large_paragraph(clause_text, max_clause_size);
                for sub in subs {
                    chunks.push(Self::make_chunk(
                        &sub, index, doc_id, ws_id,
                        ChunkType::LegalClause, Some(title.clone()),
                    ));
                    index += 1;
                }
            }
        }
        chunks
    }

    // -----------------------------------------------------------------------
    // Estratégia 3 — Por Sentenças
    // -----------------------------------------------------------------------
    fn chunk_by_sentences(
        doc: &ExtractedDocument,
        target_size: usize,
        max_size: usize,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        let mut chunks = Vec::new();
        let mut index = 0u32;
        let mut buf = String::new();
        let mut buf_tokens = 0usize;

        for sentence in doc.raw_text.split(|c| c == '.' || c == '?') {
            let s = sentence.trim();
            if s.is_empty() { continue; }
            let t = SimpleTokenizer::count_tokens(s);
            if buf_tokens + t > max_size {
                if !buf.is_empty() {
                    chunks.push(Self::make_chunk(
                        &buf, index, doc_id, ws_id, ChunkType::Paragraph, None,
                    ));
                    index += 1;
                }
                buf = s.to_string();
                buf_tokens = t;
            } else {
                if !buf.is_empty() { buf.push_str(". "); }
                buf.push_str(s);
                buf_tokens += t;
                if buf_tokens >= target_size {
                    chunks.push(Self::make_chunk(
                        &buf, index, doc_id, ws_id, ChunkType::Paragraph, None,
                    ));
                    index += 1;
                    buf.clear();
                    buf_tokens = 0;
                }
            }
        }
        if !buf.is_empty() {
            chunks.push(Self::make_chunk(&buf, index, doc_id, ws_id, ChunkType::Paragraph, None));
        }
        chunks
    }

    // -----------------------------------------------------------------------
    // Estratégia 4 — Tamanho Fixo com Overlap
    // -----------------------------------------------------------------------
    fn chunk_fixed(
        doc: &ExtractedDocument,
        chunk_size: usize,
        overlap: usize,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        let words: Vec<&str> = doc.raw_text.split_whitespace().collect();
        let mut chunks = Vec::new();
        let mut i = 0usize;
        let mut index = 0u32;
        while i < words.len() {
            let end = (i + chunk_size).min(words.len());
            let content = words[i..end].join(" ");
            chunks.push(Self::make_chunk(
                &content, index, doc_id, ws_id, ChunkType::Paragraph, None,
            ));
            index += 1;
            if end == words.len() { break; }
            i = i + chunk_size - overlap;
        }
        chunks
    }

    // -----------------------------------------------------------------------
    // Estratégia 5 — Tabelas
    // -----------------------------------------------------------------------
    fn chunk_by_tables(
        doc: &ExtractedDocument,
        doc_id: Uuid,
        ws_id: Uuid,
    ) -> Vec<Chunk> {
        // Agrupa linhas de tabela e cria um chunk por bloco
        let mut chunks = Vec::new();
        let mut index = 0u32;
        let mut table_buf = String::new();
        let mut in_table = false;

        for line in doc.raw_text.lines() {
            let is_table_line = line.matches('|').count() >= 2 || line.matches('\t').count() >= 2;
            if is_table_line {
                in_table = true;
                table_buf.push_str(line);
                table_buf.push('\n');
            } else {
                if in_table && !table_buf.is_empty() {
                    chunks.push(Self::make_chunk(
                        &table_buf, index, doc_id, ws_id, ChunkType::Table, None,
                    ));
                    index += 1;
                    table_buf.clear();
                    in_table = false;
                }
                // Linha fora da tabela vai como parágrafo
                if !line.trim().is_empty() {
                    chunks.push(Self::make_chunk(
                        line.trim(), index, doc_id, ws_id, ChunkType::Paragraph, None,
                    ));
                    index += 1;
                }
            }
        }
        if !table_buf.is_empty() {
            chunks.push(Self::make_chunk(
                &table_buf, index, doc_id, ws_id, ChunkType::Table, None,
            ));
        }
        chunks
    }

    // -----------------------------------------------------------------------
    // Construtor de Chunk
    // -----------------------------------------------------------------------
    fn make_chunk(
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
            total_chunks: 0,  // preenchido no pós-processamento
            section_title,
            page_number: None,
            chunk_type,
            token_count: 0,   // preenchido no pós-processamento
            previous_chunk_id: None,
            next_chunk_id: None,
            embedding: None,
        }
    }
}
