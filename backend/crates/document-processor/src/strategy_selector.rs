use super::chunker::ChunkingStrategy;
use super::extractor::ExtractedDocument;

pub struct StrategySelector;

impl StrategySelector {
    pub fn select(extracted: &ExtractedDocument, workspace_sector: &str) -> ChunkingStrategy {
        // Documento dominantemente tabular
        if extracted.has_tables && Self::is_mostly_tabular(&extracted.raw_text) {
            return ChunkingStrategy::FixedSize { chunk_size: 512, overlap: 0 };
        }

        match workspace_sector {
            "legal" | "juridico" => {
                if Self::has_legal_structure(&extracted.raw_text) {
                    return ChunkingStrategy::Legal {
                        max_clause_size: 800,
                        group_subclauses: true,
                    };
                }
            }
            _ => {}
        }

        if extracted.sections.len() >= 3 {
            return ChunkingStrategy::Semantic {
                max_chunk_size: 512,
                min_chunk_size: 100,
                respect_sections: true,
            };
        }

        if Self::avg_paragraph_length(&extracted.raw_text) > 200 {
            return ChunkingStrategy::Sentence { target_size: 400, max_size: 600 };
        }

        ChunkingStrategy::FixedSize { chunk_size: 512, overlap: 50 }
    }

    fn has_legal_structure(text: &str) -> bool {
        let re = regex::Regex::new(r"(?i)(cláusula|artigo|art\.)\s*\d+").unwrap();
        re.find_iter(text).count() >= 3
    }

    fn is_mostly_tabular(text: &str) -> bool {
        let tabular_lines = text.lines().filter(|l| l.contains("  ") && l.split("  ").count() >= 3).count();
        let total = text.lines().count();
        total > 0 && (tabular_lines as f32 / total as f32) > 0.4
    }

    fn avg_paragraph_length(text: &str) -> usize {
        let paragraphs: Vec<&str> = text.split("\n\n").filter(|p| !p.trim().is_empty()).collect();
        if paragraphs.is_empty() { return 0; }
        paragraphs.iter().map(|p| p.len()).sum::<usize>() / paragraphs.len()
    }
}
