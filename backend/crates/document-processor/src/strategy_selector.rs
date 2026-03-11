use regex::Regex;
use crate::chunker::ChunkingStrategy;
use crate::extractor::ExtractedDocument;

/// Parâmetros recomendados por setor (baseado na documentação do projeto)
pub struct SectorConfig {
    pub chunk_size: usize,
    pub overlap: usize,
    pub top_k: usize,
    pub rerank: bool,
    pub expand_context: bool,
}

impl SectorConfig {
    pub fn for_sector(sector: &str) -> Self {
        match sector {
            "legal" | "juridico" => Self {
                chunk_size: 700, overlap: 100, top_k: 6, rerank: true, expand_context: true,
            },
            "health" | "saude" | "medical" => Self {
                chunk_size: 500, overlap: 80, top_k: 5, rerank: true, expand_context: true,
            },
            "finance" | "fintech" => Self {
                chunk_size: 400, overlap: 50, top_k: 4, rerank: false, expand_context: false,
            },
            _ => Self {
                chunk_size: 512, overlap: 50, top_k: 5, rerank: false, expand_context: true,
            },
        }
    }
}

pub struct StrategySelector;

impl StrategySelector {
    /// Analisa o documento e seleciona a melhor estratégia de chunking automática
    pub fn select(
        extracted: &ExtractedDocument,
        workspace_sector: &str,
    ) -> ChunkingStrategy {
        let cfg = SectorConfig::for_sector(workspace_sector);

        // 1. Documento majoritariamente tabular?
        if extracted.has_tables && Self::is_mostly_tabular(&extracted.raw_text) {
            return ChunkingStrategy::Table;
        }

        // 2. Setor jurídico com estrutura de cláusulas?
        if matches!(workspace_sector, "legal" | "juridico")
            && Self::has_legal_structure(&extracted.raw_text)
        {
            return ChunkingStrategy::Legal {
                max_clause_size: cfg.chunk_size,
                group_subclauses: true,
            };
        }

        // 3. Setor saúde com estrutura médica?
        if matches!(workspace_sector, "health" | "saude" | "medical")
            && Self::has_medical_structure(&extracted.raw_text)
        {
            return ChunkingStrategy::Medical {
                max_section_size: cfg.chunk_size,
                include_patient_context: true,
            };
        }

        // 4. Documento com estrutura clara (3+ seções detectadas)?
        if extracted.sections.len() >= 3 {
            return ChunkingStrategy::Semantic {
                max_chunk_size: cfg.chunk_size,
                min_chunk_size: 100,
                respect_sections: true,
            };
        }

        // 5. Texto corrido sem estrutura (parágrafos longos)?
        if Self::avg_paragraph_length(&extracted.raw_text) > 200 {
            return ChunkingStrategy::Sentence {
                target_size: cfg.chunk_size,
                max_size: cfg.chunk_size + 100,
            };
        }

        // 6. Fallback genérico
        ChunkingStrategy::FixedSize {
            chunk_size: cfg.chunk_size,
            overlap: cfg.overlap,
        }
    }

    fn has_legal_structure(text: &str) -> bool {
        let legal_re = Regex::new(r"(?i)cl[aá]usula|artigo|art\.").unwrap();
        legal_re.find_iter(text).count() >= 3
    }

    fn has_medical_structure(text: &str) -> bool {
        let terms = [
            "anamnese", "diagnóstico", "prescrição",
            "evolução", "exames", "prontuário", "cid-10", "queixa principal",
        ];
        let lower = text.to_lowercase();
        terms.iter().filter(|t| lower.contains(*t)).count() >= 2
    }

    fn is_mostly_tabular(text: &str) -> bool {
        let lines: Vec<&str> = text.lines().collect();
        if lines.is_empty() { return false; }
        let table_like = lines.iter().filter(|l| l.contains("  ") && l.split_whitespace().count() >= 2).count();
        table_like as f64 / lines.len() as f64 > 0.5
    }

    fn avg_paragraph_length(text: &str) -> usize {
        let paras: Vec<&str> = text.split("\n\n").filter(|p| !p.trim().is_empty()).collect();
        if paras.is_empty() { return 0; }
        let total_chars: usize = paras.iter().map(|p| p.len()).sum();
        total_chars / paras.len()
    }
}
