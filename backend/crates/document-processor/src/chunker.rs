use crate::strategy::ChunkingStrategy;

/// Representa um chunk de texto pronto para embedding.
#[derive(Debug, Clone)]
pub struct Chunk {
    pub index: usize,
    pub section: String,
    pub content: String,
    pub tokens: usize,
}

impl Chunk {
    fn new(index: usize, section: impl Into<String>, content: impl Into<String>) -> Self {
        let content = content.into();
        let tokens = content.len() / 4;
        Self {
            index,
            section: section.into(),
            content,
            tokens,
        }
    }
}

/// Divide o texto conforme a estrat\u{e9}gia escolhida.
pub fn chunk_text(text: &str, strategy: &ChunkingStrategy) -> Vec<Chunk> {
    if text.trim().is_empty() {
        return Vec::new();
    }
    match strategy {
        ChunkingStrategy::Semantic => chunk_semantic(text, 512),
        ChunkingStrategy::Legal => chunk_semantic(text, 800),
        ChunkingStrategy::Medical => chunk_semantic(text, 600),
        ChunkingStrategy::Sentence => chunk_sentences(text, 400, 600),
        ChunkingStrategy::FixedSize { size, overlap } => chunk_fixed(text, *size, *overlap),
        ChunkingStrategy::Table => chunk_tables(text),
    }
}

// ── Sem\u{e2}ntico (por se\u{e7}\u{f5}es Markdown / cabe\u{e7}alhos) ─────────────────────────────

fn chunk_semantic(text: &str, max_tokens: usize) -> Vec<Chunk> {
    let max_chars = max_tokens * 4;
    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut section = String::from("Introdu\u{e7}\u{e3}o");
    let mut idx = 0;

    for line in text.lines() {
        let trimmed = line.trim();
        if is_section_header(trimmed) {
            if !current.trim().is_empty() {
                flush_chunk(&mut chunks, &mut idx, &section, &mut current, max_chars);
            }
            section = trimmed.trim_start_matches('#').trim().to_string();
            if section.is_empty() {
                section = trimmed.to_string();
            }
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
        || line.starts_with("CAP\u{cd}TULO")
        || line.starts_with("SE\u{c7}\u{c3}O")
        || line.starts_with("Artigo")
        || line.starts_with("Art.")
        || (line.len() < 80 && line.ends_with(':') && !line.contains('.'))
}

fn flush_chunk(
    chunks: &mut Vec<Chunk>,
    idx: &mut usize,
    section: &str,
    current: &mut String,
    max_chars: usize,
) {
    let text = current.trim().to_string();
    if text.is_empty() {
        current.clear();
        return;
    }
    if text.len() <= max_chars {
        chunks.push(Chunk::new(*idx, section, text));
        *idx += 1;
    } else {
        for part in text.as_bytes().chunks(max_chars) {
            let s = String::from_utf8_lossy(part).to_string();
            if !s.trim().is_empty() {
                chunks.push(Chunk::new(*idx, section, s.trim()));
                *idx += 1;
            }
        }
    }
    current.clear();
}

// ── Por senten\u{e7}as ─────────────────────────────────────────────────────────────

fn chunk_sentences(text: &str, min_tokens: usize, max_tokens: usize) -> Vec<Chunk> {
    let min_chars = min_tokens * 4;
    let max_chars = max_tokens * 4;
    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut idx = 0;

    for sentence in split_sentences(text) {
        current.push_str(&sentence);
        if current.len() >= min_chars {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                chunks.push(Chunk::new(idx, "Texto", trimmed));
                idx += 1;
            }
            current.clear();
        }
        if current.len() > max_chars {
            let trimmed = current.trim().to_string();
            chunks.push(Chunk::new(idx, "Texto", trimmed));
            idx += 1;
            current.clear();
        }
    }
    if !current.trim().is_empty() {
        chunks.push(Chunk::new(idx, "Texto", current.trim()));
    }
    chunks
}

fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();
    for ch in text.chars() {
        current.push(ch);
        if matches!(ch, '.' | '!' | '?') {
            let s = current.trim().to_string();
            if !s.is_empty() {
                sentences.push(s);
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
    let size = size_tokens * 4;
    // overlap deve ser menor que size para garantir progressão
    let overlap = (overlap_tokens * 4).min(size.saturating_sub(1));
    let chars: Vec<char> = text.chars().collect();
    let total = chars.len();
    let mut chunks = Vec::new();
    let mut start = 0;
    let mut idx = 0;

    while start < total {
        let end = (start + size).min(total);

        // Tenta n\u{e3}o cortar no meio de uma palavra (s\u{f3} se houver espa\u{e7}o no intervalo)
        let actual_end = if end < total {
            let mut e = end;
            while e > start + 1 && !chars[e].is_whitespace() {
                e -= 1;
            }
            // Se n\u{e3}o encontrou espa\u{e7}o, usa end original
            if e <= start {
                end
            } else {
                e
            }
        } else {
            end
        };

        let s: String = chars[start..actual_end].iter().collect();
        if !s.trim().is_empty() {
            chunks.push(Chunk::new(idx, "Texto", s.trim()));
            idx += 1;
        }

        // Pr\u{f3}ximo start com overlap; garante avan\u{e7}o m\u{ed}nimo de 1
        let next_start = if actual_end > overlap {
            actual_end - overlap
        } else {
            actual_end
        };
        // Prote\u{e7}\u{e3}o contra loop infinito: start deve sempre avan\u{e7}ar
        start = next_start.max(start + 1);
    }
    chunks
}

// ── Tabelas ───────────────────────────────────────────────────────────────────

fn chunk_tables(text: &str) -> Vec<Chunk> {
    let mut chunks = Vec::new();
    let mut idx = 0;
    let mut in_table = false;
    let mut table_buf = String::new();
    let mut prose_buf = String::new();

    for line in text.lines() {
        let trimmed = line.trim();
        let is_table_line = trimmed.starts_with('|') || trimmed.starts_with("+-");
        if is_table_line {
            if !in_table {
                if !prose_buf.trim().is_empty() {
                    chunks.push(Chunk::new(idx, "Texto", prose_buf.trim()));
                    idx += 1;
                    prose_buf.clear();
                }
                in_table = true;
            }
            table_buf.push_str(trimmed);
            table_buf.push('\n');
        } else {
            if in_table {
                if !table_buf.trim().is_empty() {
                    chunks.push(Chunk::new(idx, "Tabela", table_buf.trim()));
                    idx += 1;
                    table_buf.clear();
                }
                in_table = false;
            }
            prose_buf.push_str(trimmed);
            prose_buf.push('\n');
        }
    }
    if in_table && !table_buf.trim().is_empty() {
        chunks.push(Chunk::new(idx, "Tabela", table_buf.trim()));
        idx += 1;
    }
    if !prose_buf.trim().is_empty() {
        chunks.push(Chunk::new(idx, "Texto", prose_buf.trim()));
    }
    chunks
}
