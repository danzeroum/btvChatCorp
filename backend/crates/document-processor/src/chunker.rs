use crate::strategy::ChunkingStrategy;

/// Representa um chunk de texto pronto para embedding.
#[derive(Debug, Clone)]
pub struct Chunk {
    pub index:   usize,
    pub section: String,  // título/seção de contexto
    pub content: String,
    pub tokens:  usize,   // estimativa: chars / 4
}

impl Chunk {
    fn new(index: usize, section: impl Into<String>, content: impl Into<String>) -> Self {
        let content = content.into();
        let tokens  = content.len() / 4;
        Self { index, section: section.into(), content, tokens }
    }
}

/// Divide o texto conforme a estratégia escolhida.
pub fn chunk_text(text: &str, strategy: &ChunkingStrategy) -> Vec<Chunk> {
    match strategy {
        ChunkingStrategy::Semantic               => chunk_semantic(text, 512),
        ChunkingStrategy::Legal                  => chunk_semantic(text, 800),
        ChunkingStrategy::Medical                => chunk_semantic(text, 600),
        ChunkingStrategy::Sentence               => chunk_sentences(text, 400, 600),
        ChunkingStrategy::FixedSize { size, overlap } => chunk_fixed(text, *size, *overlap),
        ChunkingStrategy::Table                  => chunk_tables(text),
    }
}

// ── Semântico (por seções/parágrafos) ────────────────────────────────────────

fn chunk_semantic(text: &str, max_tokens: usize) -> Vec<Chunk> {
    let max_chars = max_tokens * 4;
    let mut chunks  = Vec::new();
    let mut current = String::new();
    let mut section = String::from("Introdução");
    let mut idx     = 0;

    for line in text.lines() {
        let trimmed = line.trim();

        // Detecta cabeçalho de seção
        if is_section_header(trimmed) {
            if !current.trim().is_empty() {
                flush_chunk(&mut chunks, &mut idx, &section, &mut current, max_chars);
            }
            section = trimmed.trim_start_matches('#').trim().to_string();
            if section.is_empty() { section = trimmed.to_string(); }
            continue;
        }

        current.push_str(trimmed);
        current.push('\n');

        if current.len() >= max_chars {
            flush_chunk(&mut chunks, &mut idx, &section, &mut current, max_chars);
        }
    }
    if !current.trim().is_empty() {
        chunks.push(Chunk::new(idx, &section, current.trim()));
    }
    chunks
}

fn is_section_header(line: &str) -> bool {
    line.starts_with('#')
        || line.starts_with("Capítulo")
        || line.starts_with("Seção")
        || line.starts_with("CAPÍTULO")
        || line.starts_with("SEÇÃO")
        || line.starts_with("Artigo")
        || line.starts_with("Art.")
        || (line.len() < 80 && line.ends_with(':') && !line.contains('.') )
}

fn flush_chunk(
    chunks: &mut Vec<Chunk>,
    idx: &mut usize,
    section: &str,
    current: &mut String,
    max_chars: usize,
) {
    // Se muito grande, divide por parágrafos
    if current.len() > max_chars * 2 {
        for para in current.split("\n\n") {
            if !para.trim().is_empty() {
                chunks.push(Chunk::new(*idx, section, para.trim()));
                *idx += 1;
            }
        }
    } else {
        chunks.push(Chunk::new(*idx, section, current.trim()));
        *idx += 1;
    }
    current.clear();
}

// ── Por frases ───────────────────────────────────────────────────────────────

fn chunk_sentences(text: &str, min_tokens: usize, max_tokens: usize) -> Vec<Chunk> {
    let min_chars = min_tokens * 4;
    let max_chars = max_tokens * 4;
    let mut chunks  = Vec::new();
    let mut current = String::new();
    let mut idx     = 0;

    for sentence in split_sentences(text) {
        current.push_str(&sentence);
        current.push(' ');

        if current.len() >= min_chars {
            if current.len() >= max_chars {
                chunks.push(Chunk::new(idx, "Texto", current.trim()));
                idx += 1;
                current.clear();
            }
        }
    }
    if !current.trim().is_empty() {
        chunks.push(Chunk::new(idx, "Texto", current.trim()));
    }
    chunks
}

fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current   = String::new();
    for ch in text.chars() {
        current.push(ch);
        if matches!(ch, '.' | '!' | '?') {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current.clear();
        }
    }
    if !current.trim().is_empty() {
        sentences.push(current.trim().to_string());
    }
    sentences
}

// ── Tamanho fixo com overlap ─────────────────────────────────────────────────

fn chunk_fixed(text: &str, size_tokens: usize, overlap_tokens: usize) -> Vec<Chunk> {
    let size    = size_tokens    * 4;
    let overlap = overlap_tokens * 4;
    let chars: Vec<char> = text.chars().collect();
    let total   = chars.len();
    let mut chunks = Vec::new();
    let mut start  = 0;
    let mut idx    = 0;

    while start < total {
        let end: usize = (start + size).min(total);
        // Tenta não cortar no meio de uma palavra
        let actual_end = if end < total {
            let mut e = end;
            while e > start && !chars[e].is_whitespace() { e -= 1; }
            if e == start { end } else { e }
        } else {
            end
        };

        let chunk_text: String = chars[start..actual_end].iter().collect();
        chunks.push(Chunk::new(idx, "Conteúdo", chunk_text.trim()));
        idx += 1;

        // Avança com overlap
        start = if actual_end > overlap { actual_end - overlap } else { actual_end };
        if start >= total { break; }
    }
    chunks
}

// ── Tabelas ─────────────────────────────────────────────────────────────────

fn chunk_tables(text: &str) -> Vec<Chunk> {
    let mut chunks = Vec::new();
    let mut idx    = 0;
    let mut in_table = false;
    let mut table_buf = String::new();
    let mut prose_buf = String::new();

    for line in text.lines() {
        let is_table_line = line.contains('|') || line.starts_with("+-");

        if is_table_line {
            if !prose_buf.trim().is_empty() {
                chunks.push(Chunk::new(idx, "Texto", prose_buf.trim()));
                idx += 1;
                prose_buf.clear();
            }
            in_table = true;
            table_buf.push_str(line);
            table_buf.push('\n');
        } else {
            if in_table && !table_buf.trim().is_empty() {
                chunks.push(Chunk::new(idx, "Tabela", table_buf.trim()));
                idx += 1;
                table_buf.clear();
                in_table = false;
            }
            prose_buf.push_str(line);
            prose_buf.push('\n');
        }
    }
    // flush finais
    if !table_buf.trim().is_empty() {
        chunks.push(Chunk::new(idx, "Tabela", table_buf.trim()));
        idx += 1;
    }
    if !prose_buf.trim().is_empty() {
        chunks.push(Chunk::new(idx, "Texto", prose_buf.trim()));
    }
    chunks
}
