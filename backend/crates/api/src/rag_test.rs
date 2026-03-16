//! Testes unitarios para funcoes puras do modulo rag.

#[cfg(test)]
mod rag_unit_tests {
    use crate::rag::{build_rag_context, build_sources_json, RagChunk};

    fn make_chunk(filename: &str, section: &str, content: &str, score: f32) -> RagChunk {
        RagChunk {
            content: content.to_string(),
            filename: filename.to_string(),
            section: section.to_string(),
            chunk_index: 0,
            score,
        }
    }

    #[test]
    fn build_rag_context_empty_returns_none() {
        assert!(build_rag_context(&[]).is_none());
    }

    #[test]
    fn build_rag_context_includes_filename_and_section() {
        let chunks = vec![make_chunk("manual_rh.pdf", "Ferias", "Ferias sao 30 dias.", 0.9)];
        let ctx = build_rag_context(&chunks).unwrap();
        assert!(ctx.contains("manual_rh.pdf"), "filename ausente: {}", ctx);
        assert!(ctx.contains("Ferias"), "section ausente: {}", ctx);
        assert!(ctx.contains("Ferias sao 30 dias."), "conteudo ausente");
    }

    #[test]
    fn build_rag_context_numbers_sources_correctly() {
        let chunks = vec![
            make_chunk("a.pdf", "S1", "Conteudo A", 0.9),
            make_chunk("b.pdf", "S2", "Conteudo B", 0.8),
            make_chunk("c.pdf", "S3", "Conteudo C", 0.7),
        ];
        let ctx = build_rag_context(&chunks).unwrap();
        assert!(ctx.contains("Fonte 1"));
        assert!(ctx.contains("Fonte 2"));
        assert!(ctx.contains("Fonte 3"));
    }

    #[test]
    fn build_rag_context_contains_instruction_text() {
        let chunks = vec![make_chunk("doc.pdf", "Intro", "Texto qualquer.", 0.85)];
        let ctx = build_rag_context(&chunks).unwrap();
        assert!(ctx.contains("Cite a fonte"), "Instrucao de citacao ausente: {}", ctx);
    }

    #[test]
    fn build_sources_json_empty_returns_none() {
        assert!(build_sources_json(&[]).is_none());
    }

    #[test]
    fn build_sources_json_contains_all_fields() {
        let chunks = vec![make_chunk("relatorio.pdf", "Resultados", "Dados.", 0.88)];
        let json = build_sources_json(&chunks).unwrap();
        let arr = json.as_array().unwrap();
        assert_eq!(arr.len(), 1);
        let first = &arr[0];
        assert_eq!(first["filename"].as_str().unwrap(), "relatorio.pdf");
        assert_eq!(first["section"].as_str().unwrap(), "Resultados");
        assert!((first["score"].as_f64().unwrap() - 0.88).abs() < 0.01);
    }

    #[test]
    fn build_sources_json_preserves_order() {
        let chunks = vec![
            make_chunk("primeiro.pdf", "A", "c1", 0.9),
            make_chunk("segundo.pdf", "B", "c2", 0.8),
            make_chunk("terceiro.pdf", "C", "c3", 0.7),
        ];
        let json = build_sources_json(&chunks).unwrap();
        let arr = json.as_array().unwrap();
        assert_eq!(arr[0]["filename"].as_str().unwrap(), "primeiro.pdf");
        assert_eq!(arr[1]["filename"].as_str().unwrap(), "segundo.pdf");
        assert_eq!(arr[2]["filename"].as_str().unwrap(), "terceiro.pdf");
    }

    #[test]
    fn build_sources_json_multiple_chunks_same_file() {
        let chunks = vec![
            make_chunk("manual.pdf", "Cap1", "c1", 0.9),
            make_chunk("manual.pdf", "Cap2", "c2", 0.85),
        ];
        let json = build_sources_json(&chunks).unwrap();
        let arr = json.as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert!(arr
            .iter()
            .all(|e| e["filename"].as_str().unwrap() == "manual.pdf"));
    }
}
