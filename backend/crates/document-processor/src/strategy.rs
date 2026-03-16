use crate::models::{
    ExtractedDocument, ChunkingStrategy,
};

/// Seleciona a melhor estratégia de chunking baseada no conteúdo e setor
pub struct StrategySelector;

impl StrategySelector {
    pub fn select(
        extracted: &ExtractedDocument,
        workspace_sector: &str,
    ) -> ChunkingStrategy {
        // 1. Documento predominantemente tabular
        if extracted.has_tables && Self::is_mostly_tabular(&extracted.raw_text) {
            return ChunkingStrategy::Table;
        }

        // 2. Baseado no setor configurado no workspace
        match workspace_sector {
            "legal" | "juridico" if Self::has_legal_structure(&extracted.raw_text) => {
                return ChunkingStrategy::Legal {
                    max_clause_size: 800,
                    group_sub_clauses: true,
                };
            }
            "health" | "saude" | "medical" if Self::has_medical_structure(&extracted.raw_text) => {
                return ChunkingStrategy::Medical {
                    max_section_size: 600,
                    include_patient_context: true,
                };
            }
            _ => {}
        }

        // 3. Documento com estrutura clara (seções detectadas)
        if extracted.sections.len() >= 3 {
            return ChunkingStrategy::Semantic {
                max_chunk_size: 512,
                min_chunk_size: 100,
                respect_sections: true,
            };
        }

        // 4. Texto corrido sem estrutura
        if Self::avg_paragraph_length(&extracted.raw_text) > 200 {
            return ChunkingStrategy::Sentence {
                target_size: 400,
                max_size: 600,
            };
        }

        // 5. Fallback: tamanho fixo com overlap
        ChunkingStrategy::FixedSize {
            chunk_size: 512,
            overlap: 50,
        }
    }

    fn is_mostly_tabular(text: &str) -> bool {
        let table_lines = text
            .lines()
            .filter(|l| l.matches('|').count() >= 2 || l.matches('\t').count() >= 3)
            .count();
        let total = text.lines().count().max(1);
        (table_lines as f32 / total as f32) > 0.25
    }

    fn has_legal_structure(text: &str) -> bool {
        let re = regex::Regex::new(r"(?i)(cláusula|artigo|art\.\s*\d+)").unwrap();
        re.find_iter(text).count() >= 3
    }

    fn has_medical_structure(text: &str) -> bool {
        let terms = [
            "anamnese", "diagnóstico", "prescrição",
            "evolução", "exames", "prontuário", "cid-10",
        ];
        let lower = text.to_lowercase();
        terms.iter().filter(|t| lower.contains(*t)).count() >= 2
    }

    fn avg_paragraph_length(text: &str) -> f32 {
        let paragraphs: Vec<&str> = text
            .split("\n\n")
            .filter(|p| !p.trim().is_empty())
            .collect();
        if paragraphs.is_empty() { return 0.0; }
        let total: usize = paragraphs.iter().map(|p| p.len()).sum();
        total as f32 / paragraphs.len() as f32
    }
}

// Necessario definir ChunkingStrategy aqui para o models.rs poder re-exportar
#[derive(Debug, Clone)]
pub enum ChunkingStrategy {
    FixedSize { chunk_size: usize, overlap: usize },
    Semantic  { max_chunk_size: usize, min_chunk_size: usize, respect_sections: bool },
    Sentence  { target_size: usize, max_size: usize },
    Legal     { max_clause_size: usize, group_sub_clauses: bool },
    Medical   { max_section_size: usize, include_patient_context: bool },
    Table,
}
