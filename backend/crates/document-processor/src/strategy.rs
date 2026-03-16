/// Estratégia de chunking a aplicar no documento.
#[derive(Debug, Clone)]
pub enum ChunkingStrategy {
    /// Divide por seções (##, títulos, separadores).
    Semantic,
    /// Preserva cláusulas jurídicas longas.
    Legal,
    /// Preserva terminologia médica e seções clínicas.
    Medical,
    /// Divide por frases para texto corrido.
    Sentence,
    /// Tamanho fixo com overlap — fallback.
    FixedSize { size: usize, overlap: usize },
    /// Mantém blocos de tabelas intactos.
    Table,
}

/// Detecta automaticamente a melhor estratégia.
///
/// * `text`     — texto extraído do documento
/// * `filename` — nome original do arquivo
/// * `sector`   — setor do workspace (ex: `Some("juridico")`)
pub fn detect_strategy(
    text: &str,
    filename: &str,
    sector: Option<&str>,
) -> ChunkingStrategy {
    let lower    = text.to_lowercase();
    let filename = filename.to_lowercase();

    // Setor explícito tem prioridade
    if let Some(s) = sector {
        match s {
            "juridico" | "legal" => return ChunkingStrategy::Legal,
            "saude" | "medico" | "health" => return ChunkingStrategy::Medical,
            _ => {}
        }
    }

    // Detecção por palavras-chave no conteúdo
    let legal_keywords = [
        "cláusula", "contrato", "artigo", "parágrafo", "inciso",
        "lei n", "decreto", "portaria", "resolução", "instrução normativa",
    ];
    let medical_keywords = [
        "paciente", "diagnóstico", "prescrição", "anamnese",
        "cid-", "prontuário", "laudo", "exame",
    ];
    let table_indicators = ["|\t", "| ---", "+-", "\t\t\t"];

    let legal_score: usize = legal_keywords.iter()
        .filter(|&&kw| lower.contains(kw))
        .count();
    let medical_score: usize = medical_keywords.iter()
        .filter(|&&kw| lower.contains(kw))
        .count();
    let table_score: usize = table_indicators.iter()
        .filter(|&&ind| text.contains(ind))
        .count();

    // Heurísticas de nome de arquivo
    let legal_names  = ["contrato", "acordo", "lei", "decreto", "portaria", "inpi"];
    let legal_name_hit = legal_names.iter().any(|&n| filename.contains(n));

    if legal_score >= 3 || legal_name_hit {
        return ChunkingStrategy::Legal;
    }
    if medical_score >= 3 {
        return ChunkingStrategy::Medical;
    }
    if table_score >= 2 {
        return ChunkingStrategy::Table;
    }

    // Texto tem estrutura de seções?
    let has_sections = text.contains("\n## ")
        || text.contains("\n# ")
        || text.contains("\n1. ")
        || text.contains("\nCapítulo")
        || text.contains("\nSeção");

    if has_sections {
        return ChunkingStrategy::Semantic;
    }

    // Texto longo e corrido
    let avg_sentence_len = text.len() / (text.matches('.').count().max(1));
    if avg_sentence_len < 200 {
        return ChunkingStrategy::Sentence;
    }

    ChunkingStrategy::FixedSize { size: 512, overlap: 50 }
}
