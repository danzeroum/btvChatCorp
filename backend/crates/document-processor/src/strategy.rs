use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChunkingStrategy {
    Semantic,
    Legal,
    Medical,
    Sentence,
    FixedSize { size: usize, overlap: usize },
    Table,
}

/// Detecta a melhor estrat\u{e9}gia de chunking para um documento.
///
/// Prioridade: setor expl\u{ed}cito > heur\u{ed}sticas de conte\u{fa}do > heur\u{ed}sticas de nome > fallback
///
/// * `text`     \u{2014} texto extra\u{ed}do do documento
/// * `filename` \u{2014} nome original do arquivo
/// * `sector`   \u{2014} setor do workspace (ex: `Some("juridico")`)
pub fn detect_strategy(text: &str, filename: &str, sector: Option<&str>) -> ChunkingStrategy {
    let lower = text.to_lowercase();
    let filename = filename.to_lowercase();

    if let Some(s) = sector {
        match s {
            "juridico" | "legal" => return ChunkingStrategy::Legal,
            "saude" | "medical" | "medico" => return ChunkingStrategy::Medical,
            _ => {}
        }
    }

    let legal_keywords = [
        "cl\u{e1}usula",
        "contrato",
        "artigo",
        "par\u{e1}grafo",
        "inciso",
        "lei n",
        "decreto",
        "portaria",
        "resolu\u{e7}\u{e3}o",
        "instru\u{e7}\u{e3}o normativa",
    ];
    let medical_keywords = [
        "paciente",
        "diagn\u{f3}stico",
        "prescri\u{e7}\u{e3}o",
        "anamnese",
        "cid-",
        "prontu\u{e1}rio",
        "laudo",
        "exame",
    ];
    let table_indicators = ["\u{9}\u{9}", "| ---", "+-", "\t\t\t"];

    let legal_score: usize = legal_keywords
        .iter()
        .filter(|&&kw| lower.contains(kw))
        .count();
    let medical_score: usize = medical_keywords
        .iter()
        .filter(|&&kw| lower.contains(kw))
        .count();
    let table_score: usize = table_indicators
        .iter()
        .filter(|&&ind| text.contains(ind))
        .count();

    let legal_names = ["contrato", "acordo", "lei", "decreto", "portaria", "inpi"];
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

    let line_count = text.lines().count();
    let header_count = text.lines().filter(|l| l.trim().starts_with('#')).count();
    let avg_line_len = if line_count > 0 {
        text.len() / line_count
    } else {
        0
    };

    if header_count >= 3 {
        return ChunkingStrategy::Semantic;
    }
    if avg_line_len < 80 && line_count > 20 {
        return ChunkingStrategy::Sentence;
    }

    ChunkingStrategy::FixedSize {
        size: 512,
        overlap: 50,
    }
}
