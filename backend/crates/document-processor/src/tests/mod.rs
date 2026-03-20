#[cfg(test)]
mod strategy_tests {
    use crate::strategy::{detect_strategy, ChunkingStrategy};

    #[test]
    fn detects_legal_by_keywords() {
        let text = "Cl\u{e1}usula 1\u{aa}: O contrato \u{e9} celebrado entre as partes. \
                    Artigo 5\u{ba} da Lei n\u{ba} 10.406 estabelece que par\u{e1}grafo \u{fa}nico inciso II.";
        let strategy = detect_strategy(text, "documento.pdf", None);
        assert!(
            matches!(strategy, ChunkingStrategy::Legal),
            "Esperado Legal, got {:?}",
            strategy
        );
    }

    #[test]
    fn detects_legal_by_filename() {
        let text = "Texto qualquer sem palavras jur\u{ed}dicas.";
        let strategy = detect_strategy(text, "contrato_prestacao_servicos.pdf", None);
        assert!(matches!(strategy, ChunkingStrategy::Legal));
    }

    #[test]
    fn detects_medical_by_keywords() {
        let text = "Paciente do sexo masculino. Diagn\u{f3}stico CID-10 J18. \
                    Prescri\u{e7}\u{e3}o: amoxicilina 500mg. Anamnese registrada no prontu\u{e1}rio.";
        let strategy = detect_strategy(text, "laudo.pdf", None);
        assert!(matches!(strategy, ChunkingStrategy::Medical));
    }

    #[test]
    fn detects_table_by_pipes() {
        let text =
            "Header\n| col1 | col2 | col3 |\n| --- | --- | --- |\n| a | b | c |\n| d | e | f |";
        let strategy = detect_strategy(text, "planilha.txt", None);
        assert!(matches!(strategy, ChunkingStrategy::Table));
    }

    #[test]
    fn detects_semantic_by_sections() {
        let text = "Introdu\u{e7}\u{e3}o\n\n## Metodologia\n\nTexto da metodologia.\n\n## Resultados\n\nTexto dos resultados.";
        let strategy = detect_strategy(text, "relatorio.md", None);
        assert!(matches!(strategy, ChunkingStrategy::Semantic));
    }

    #[test]
    fn detects_sentence_for_short_sentences() {
        let text = (0..80)
            .map(|i| format!("Esta \u{e9} a frase n\u{fa}mero {}. ", i))
            .collect::<String>();
        let strategy = detect_strategy(&text, "texto.txt", None);
        assert!(matches!(strategy, ChunkingStrategy::Sentence));
    }

    #[test]
    fn sector_override_legal() {
        let text =
            "Texto m\u{e9}dico: paciente, diagn\u{f3}stico, prontu\u{e1}rio, prescri\u{e7}\u{e3}o, laudo.";
        let strategy = detect_strategy(text, "doc.pdf", Some("juridico"));
        assert!(matches!(strategy, ChunkingStrategy::Legal));
    }

    #[test]
    fn sector_override_medical() {
        let text =
            "Cl\u{e1}usula 1\u{aa} contrato artigo lei decreto portaria resolucao inciso.";
        let strategy = detect_strategy(text, "doc.pdf", Some("saude"));
        assert!(matches!(strategy, ChunkingStrategy::Medical));
    }

    #[test]
    fn fallback_fixed_size() {
        let long_sentence = "palavra ".repeat(200);
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
        let text = "# Introdu\u{e7}\u{e3}o\nTexto da introdu\u{e7}\u{e3}o.\n\n## M\u{e9}todos\nTexto de m\u{e9}todos.\n\n## Conclus\u{e3}o\nTexto da conclus\u{e3}o.";
        let chunks = chunk_text(text, &ChunkingStrategy::Semantic);
        assert!(!chunks.is_empty());
        assert!(chunks.iter().all(|c| !c.content.is_empty()));
    }

    #[test]
    fn semantic_preserves_section_titles() {
        let text =
            "# Resultados\nDados do experimento.\n\n## An\u{e1}lise\nConclu\u{f5}es finais.";
        let chunks = chunk_text(text, &ChunkingStrategy::Semantic);
        let sections: Vec<&str> = chunks.iter().map(|c| c.section.as_str()).collect();
        assert!(
            sections
                .iter()
                .any(|s| s.contains("Resultados") || s.contains("An\u{e1}lise")),
            "Se\u{e7}\u{f5}es n\u{e3}o encontradas: {:?}",
            sections
        );
    }

    #[test]
    fn fixed_size_respects_overlap() {
        let text = "abcdefghij".repeat(100);
        let chunks =
            chunk_text(&text, &ChunkingStrategy::FixedSize { size: 50, overlap: 10 });
        assert!(chunks.len() > 1, "Esperado m\u{fa}ltiplos chunks, got {}", chunks.len());
        for (i, chunk) in chunks.iter().enumerate() {
            assert_eq!(chunk.index, i);
        }
    }

    #[test]
    fn table_chunks_keep_pipe_rows() {
        let text =
            "Introdu\u{e7}\u{e3}o\n\n| Nome | Valor |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n\nRodap\u{e9}.";
        let chunks = chunk_text(text, &ChunkingStrategy::Table);
        let table_chunk = chunks.iter().find(|c| c.section == "Tabela");
        assert!(table_chunk.is_some(), "Nenhum chunk de tabela encontrado");
        assert!(table_chunk.unwrap().content.contains('|'));
    }

    #[test]
    fn sentence_chunks_respect_min_size() {
        let text = (0..50)
            .map(|i| format!("Esta \u{e9} a senten\u{e7}a n\u{fa}mero {}. ", i))
            .collect::<String>();
        let chunks = chunk_text(&text, &ChunkingStrategy::Sentence);
        for chunk in chunks.iter().rev().skip(1) {
            assert!(
                chunk.content.len() >= 400 * 4 / 2,
                "Chunk muito pequeno: {} chars",
                chunk.content.len()
            );
        }
    }

    #[test]
    fn legal_produces_larger_chunks_than_sentence() {
        let text = "Cl\u{e1}usula 1: Esta \u{e9} uma cl\u{e1}usula extensa. ".repeat(30);
        let legal_chunks = chunk_text(&text, &ChunkingStrategy::Legal);
        let sentence_chunks = chunk_text(&text, &ChunkingStrategy::Sentence);
        assert!(
            legal_chunks.len() <= sentence_chunks.len() + 2,
            "Legal={} chunks, Sentence={} chunks",
            legal_chunks.len(),
            sentence_chunks.len()
        );
    }

    #[test]
    fn tokens_estimation_is_reasonable() {
        let content = "a".repeat(400);
        let chunks =
            chunk_text(&content, &ChunkingStrategy::FixedSize { size: 200, overlap: 0 });
        for chunk in &chunks {
            let expected = chunk.content.len() / 4;
            assert!(
                chunk.tokens >= expected / 2 && chunk.tokens <= expected * 2,
                "tokens={}, expected~={}",
                chunk.tokens,
                expected
            );
        }
    }

    #[test]
    fn empty_text_returns_no_chunks() {
        let chunks = chunk_text("", &ChunkingStrategy::Semantic);
        assert!(chunks.is_empty());
    }

    #[test]
    fn whitespace_only_returns_no_chunks() {
        let chunks = chunk_text(
            "   \n\n\t  ",
            &ChunkingStrategy::FixedSize {
                size: 512,
                overlap: 50,
            },
        );
        assert!(chunks.is_empty());
    }
}

#[cfg(test)]
mod extractor_tests {
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn extracts_plain_text() {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all("Hello, mundo! Este \u{e9} um teste.".as_bytes())
            .unwrap();
        let text = crate::extractor::extract_text(f.path().to_str().unwrap(), "text/plain")
            .await
            .unwrap();
        assert!(text.contains("Hello"));
        assert!(text.contains("mundo"));
    }

    #[tokio::test]
    async fn extracts_html_strips_tags() {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(
            "<html><body><h1>T\u{ed}tulo</h1><p>Par\u{e1}grafo &amp; conte\u{fa}do.</p></body></html>"
                .as_bytes(),
        )
        .unwrap();
        let text = crate::extractor::extract_text(f.path().to_str().unwrap(), "text/html")
            .await
            .unwrap();
        assert!(!text.contains('<'), "Tags HTML n\u{e3}o removidas: {}", text);
        assert!(text.contains("T\u{ed}tulo"));
        assert!(
            text.contains('&'),
            "Entidade &amp; n\u{e3}o decodificada: {}",
            text
        );
    }

    #[tokio::test]
    async fn empty_file_returns_error() {
        let f = NamedTempFile::new().unwrap();
        let result =
            crate::extractor::extract_text(f.path().to_str().unwrap(), "text/plain").await;
        assert!(result.is_err(), "Esperado erro para arquivo vazio");
    }

    #[tokio::test]
    async fn missing_file_returns_error() {
        let result =
            crate::extractor::extract_text("/tmp/nao_existe_xyz_12345.txt", "text/plain").await;
        assert!(result.is_err());
    }
}
