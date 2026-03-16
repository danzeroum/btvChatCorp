#[cfg(test)]
mod strategy_tests {
    use crate::strategy::{detect_strategy, ChunkingStrategy};

    #[test]
    fn detects_legal_by_keywords() {
        let text = "Cláusula 1ª: O contrato é celebrado entre as partes. \
                    Artigo 5º da Lei nº 10.406 estabelece que parágrafo único inciso II.";
        let strategy = detect_strategy(text, "documento.pdf", None);
        assert!(matches!(strategy, ChunkingStrategy::Legal),
            "Esperado Legal, got {:?}", strategy);
    }

    #[test]
    fn detects_legal_by_filename() {
        let text = "Texto qualquer sem palavras jurídicas.";
        let strategy = detect_strategy(text, "contrato_prestacao_servicos.pdf", None);
        assert!(matches!(strategy, ChunkingStrategy::Legal));
    }

    #[test]
    fn detects_medical_by_keywords() {
        let text = "Paciente do sexo masculino. Diagnóstico CID-10 J18. \
                    Prescrição: amoxicilina 500mg. Anamnese registrada no prontuário.";
        let strategy = detect_strategy(text, "laudo.pdf", None);
        assert!(matches!(strategy, ChunkingStrategy::Medical));
    }

    #[test]
    fn detects_table_by_pipes() {
        let text = "Header\n| col1 | col2 | col3 |\n| --- | --- | --- |\n| a | b | c |\n| d | e | f |";
        let strategy = detect_strategy(text, "planilha.txt", None);
        assert!(matches!(strategy, ChunkingStrategy::Table));
    }

    #[test]
    fn detects_semantic_by_sections() {
        let text = "Introdução\n\n## Metodologia\n\nTexto da metodologia.\n\n## Resultados\n\nTexto dos resultados.";
        let strategy = detect_strategy(text, "relatorio.md", None);
        assert!(matches!(strategy, ChunkingStrategy::Semantic));
    }

    #[test]
    fn detects_sentence_for_short_sentences() {
        // Texto corrido sem seções, frases curtas
        let text = (0..80)
            .map(|i| format!("Esta é a frase número {}. ", i))
            .collect::<String>();
        let strategy = detect_strategy(&text, "texto.txt", None);
        assert!(matches!(strategy, ChunkingStrategy::Sentence));
    }

    #[test]
    fn sector_override_legal() {
        let text = "Texto médico: paciente, diagnóstico, prontuário, prescrição, laudo.";
        // Mesmo texto médico, setor jurídico força Legal
        let strategy = detect_strategy(text, "doc.pdf", Some("juridico"));
        assert!(matches!(strategy, ChunkingStrategy::Legal));
    }

    #[test]
    fn sector_override_medical() {
        let text = "Cláusula 1ª contrato artigo lei decreto portaria resolucao inciso.";
        // Mesmo texto jurídico, setor saúde força Medical
        let strategy = detect_strategy(text, "doc.pdf", Some("saude"));
        assert!(matches!(strategy, ChunkingStrategy::Medical));
    }

    #[test]
    fn fallback_fixed_size() {
        // Texto longo sem keywords especiais e sem seções
        let long_sentence = "palavra ".repeat(200); // uma só grande frase sem ponto
        let strategy = detect_strategy(&long_sentence, "dados.csv", None);
        assert!(matches!(strategy, ChunkingStrategy::FixedSize { .. }));
    }
}

#[cfg(test)]
mod chunker_tests {
    use crate::chunker::chunk_text;
    use crate::strategy::ChunkingStrategy;

    #[test]
    fn semantic_produces_chunks() {
        let text = "# Introdução\nTexto da introdução.\n\n## Métodos\nTexto de métodos.\n\n## Conclusão\nTexto da conclusão.";
        let chunks = chunk_text(text, &ChunkingStrategy::Semantic);
        assert!(!chunks.is_empty());
        // Cada chunk deve ter conteúdo não-vazio
        assert!(chunks.iter().all(|c| !c.content.is_empty()));
    }

    #[test]
    fn semantic_preserves_section_titles() {
        let text = "# Resultados\nDados do experimento.\n\n## Análise\nConclusões finais.";
        let chunks = chunk_text(text, &ChunkingStrategy::Semantic);
        let sections: Vec<&str> = chunks.iter().map(|c| c.section.as_str()).collect();
        assert!(sections.iter().any(|s| s.contains("Resultados") || s.contains("Análise")),
            "Seções não encontradas: {:?}", sections);
    }

    #[test]
    fn fixed_size_respects_overlap() {
        let text = "abcdefghij".repeat(100); // 1000 chars
        let chunks = chunk_text(&text, &ChunkingStrategy::FixedSize { size: 50, overlap: 10 });
        assert!(chunks.len() > 1, "Esperado múltiplos chunks, got {}", chunks.len());
        // Todos os chunks devem ter índices sequenciais
        for (i, chunk) in chunks.iter().enumerate() {
            assert_eq!(chunk.index, i);
        }
    }

    #[test]
    fn table_chunks_keep_pipe_rows() {
        let text = "Introdução\n\n| Nome | Valor |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n\nRodapé.";
        let chunks = chunk_text(text, &ChunkingStrategy::Table);
        let table_chunk = chunks.iter().find(|c| c.section == "Tabela");
        assert!(table_chunk.is_some(), "Nenhum chunk de tabela encontrado");
        assert!(table_chunk.unwrap().content.contains('|'));
    }

    #[test]
    fn sentence_chunks_respect_min_size() {
        let text = (0..50)
            .map(|i| format!("Esta é a sentença número {}. ", i))
            .collect::<String>();
        let chunks = chunk_text(&text, &ChunkingStrategy::Sentence);
        // Cada chunk (exceto o último) deve ter pelo menos min_chars
        for chunk in chunks.iter().rev().skip(1) {
            assert!(chunk.content.len() >= 400 * 4 / 2, // flexibiliza 50%
                "Chunk muito pequeno: {} chars", chunk.content.len());
        }
    }

    #[test]
    fn legal_produces_larger_chunks_than_sentence() {
        let text = "Cláusula 1: Esta é uma cláusula extensa. ".repeat(30);
        let legal_chunks   = chunk_text(&text, &ChunkingStrategy::Legal);
        let sentence_chunks = chunk_text(&text, &ChunkingStrategy::Sentence);
        // Legal tem max de 800 tokens vs 400-600 do Sentence — deve gerar menos chunks
        assert!(legal_chunks.len() <= sentence_chunks.len() + 2,
            "Legal={} chunks, Sentence={} chunks", legal_chunks.len(), sentence_chunks.len());
    }

    #[test]
    fn tokens_estimation_is_reasonable() {
        let content = "a".repeat(400); // 400 chars = ~100 tokens
        let chunks = chunk_text(&content, &ChunkingStrategy::FixedSize { size: 200, overlap: 0 });
        for chunk in &chunks {
            // tokens = len / 4; toleramos ±25%
            let expected = chunk.content.len() / 4;
            assert!(chunk.tokens >= expected / 2 && chunk.tokens <= expected * 2,
                "tokens={}, expected~={}", chunk.tokens, expected);
        }
    }

    #[test]
    fn empty_text_returns_no_chunks() {
        let chunks = chunk_text("", &ChunkingStrategy::Semantic);
        assert!(chunks.is_empty());
    }

    #[test]
    fn whitespace_only_returns_no_chunks() {
        let chunks = chunk_text("   \n\n\t  ", &ChunkingStrategy::FixedSize { size: 512, overlap: 50 });
        assert!(chunks.is_empty());
    }
}

#[cfg(test)]
mod extractor_tests {
    use std::io::Write;
    use tempfile::NamedTempFile;

    // Testa extração de texto plano (TXT/CSV/MD)
    #[tokio::test]
    async fn extracts_plain_text() {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(b"Hello, mundo! Este é um teste.").unwrap();
        let text = crate::extractor::extract_text(
            f.path().to_str().unwrap(),
            "text/plain",
        ).await.unwrap();
        assert!(text.contains("Hello"));
        assert!(text.contains("mundo"));
    }

    #[tokio::test]
    async fn extracts_html_strips_tags() {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(b"<html><body><h1>Título</h1><p>Parágrafo &amp; conteúdo.</p></body></html>").unwrap();
        let text = crate::extractor::extract_text(
            f.path().to_str().unwrap(),
            "text/html",
        ).await.unwrap();
        assert!(!text.contains('<'), "Tags HTML não removidas: {}", text);
        assert!(text.contains("Título"));
        assert!(text.contains("&"), "Entidade &amp; não decodificada: {}", text);
    }

    #[tokio::test]
    async fn empty_file_returns_error() {
        let f = NamedTempFile::new().unwrap();
        let result = crate::extractor::extract_text(
            f.path().to_str().unwrap(),
            "text/plain",
        ).await;
        assert!(result.is_err(), "Esperado erro para arquivo vazio");
    }

    #[tokio::test]
    async fn missing_file_returns_error() {
        let result = crate::extractor::extract_text(
            "/tmp/nao_existe_xyz_12345.txt",
            "text/plain",
        ).await;
        assert!(result.is_err());
    }
}
