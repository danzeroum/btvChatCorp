use std::path::Path;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    chunker::{ChunkingStrategy, IntelligentChunker},
    cleaner::TextCleaner,
    embedder::Embedder,
    errors::PipelineError,
    extractor::TextExtractor,
    indexer::DocumentIndexer,
    strategy_selector::StrategySelector,
    DataClassification,
};

/// Configuração do pipeline
#[derive(Debug, Clone)]
pub struct PipelineConfig {
    pub ocr_service_url: String,
    pub embedding_service_url: String,
    pub qdrant_url: String,
    pub workspace_sector: String,
    pub override_strategy: Option<ChunkingStrategy>,
}

/// Resultado do pipeline para um documento
#[derive(Debug)]
pub struct PipelineResult {
    pub document_id: Uuid,
    pub chunks_created: usize,
    pub extraction_method: String,
    pub chunking_strategy: String,
    pub language: String,
    pub has_tables: bool,
}

/// Pipeline completo: extraeço → limpeza → estratégia → chunking → embedding → indexação
pub struct DocumentPipeline {
    extractor: TextExtractor,
    embedder: Embedder,
    indexer: DocumentIndexer,
    db: PgPool,
    config: PipelineConfig,
}

impl DocumentPipeline {
    pub fn new(db: PgPool, config: PipelineConfig) -> Result<Self, PipelineError> {
        let indexer = DocumentIndexer::new(&config.qdrant_url)
            .map_err(PipelineError::Index)?;

        Ok(Self {
            extractor: TextExtractor::new(&config.ocr_service_url),
            embedder: Embedder::new(&config.embedding_service_url),
            indexer,
            db,
            config,
        })
    }

    /// Processa um documento completo do arquivo até o Qdrant
    pub async fn process(
        &self,
        document_id: Uuid,
        workspace_id: Uuid,
        file_path: &Path,
        mime_type: &str,
        classification: &DataClassification,
        use_for_training: bool,
    ) -> Result<PipelineResult, PipelineError> {
        tracing::info!(document_id = %document_id, "Starting document pipeline");

        // Atualiza status para 'processing'
        self.update_status(document_id, "processing", None).await?;

        // ─── Etapa 1: Extraeço ───────────────────────────────────────────────
        let extracted = self
            .extractor
            .extract(file_path, mime_type)
            .await
            .map_err(PipelineError::Extraction)?;

        let extraction_method = extracted.extraction_method.clone();
        let has_tables = extracted.has_tables;

        tracing::info!(
            document_id = %document_id,
            method = %extraction_method,
            sections = extracted.sections.len(),
            "Extraction complete"
        );

        // ─── Etapa 2: Limpeza ────────────────────────────────────────────────
        let cleaned = TextCleaner::clean(extracted);
        let language = cleaned.language.clone();

        // ─── Etapa 3: Seleção de estratégia ─────────────────────────────────────────
        let strategy = if let Some(override_s) = &self.config.override_strategy {
            override_s.clone()
        } else {
            // Reconstroe ExtractedDocument para o selector (apenas para análise)
            let dummy_extracted = crate::extractor::ExtractedDocument {
                raw_text: cleaned.text.clone(),
                sections: cleaned.sections.clone(),
                extraction_method: extraction_method.clone(),
                has_tables,
                page_breaks: vec![],
            };
            StrategySelector::select(&dummy_extracted, &self.config.workspace_sector)
        };

        let strategy_name = format!("{:?}", strategy);
        tracing::info!(document_id = %document_id, strategy = %strategy_name, "Strategy selected");

        // ─── Etapa 4: Chunking ────────────────────────────────────────────────
        let mut chunks = IntelligentChunker::chunk(cleaned, strategy, document_id, workspace_id);

        tracing::info!(document_id = %document_id, chunks = chunks.len(), "Chunking complete");

        // ─── Etapa 5: Embedding ───────────────────────────────────────────────
        self.embedder
            .embed_chunks(&mut chunks)
            .await
            .map_err(PipelineError::Index)?;

        tracing::info!(document_id = %document_id, "Embeddings generated");

        // ─── Etapa 6: Indexação no Qdrant ───────────────────────────────────────
        let index_result = self
            .indexer
            .index_document(&chunks, workspace_id)
            .await
            .map_err(PipelineError::Index)?;

        tracing::info!(
            document_id = %document_id,
            chunks_indexed = index_result.chunks_indexed,
            "Indexing complete"
        );

        // ─── Etapa 7: Persiste chunks no PostgreSQL (metadados para API) ────────────
        if *classification != DataClassification::Restricted {
            self.persist_chunks_to_db(&chunks).await?;
        }

        // ─── Etapa 8: Enfileira QA sintéticos se elegível para treino ───────────
        if use_for_training && *classification != DataClassification::Restricted {
            self.enqueue_synthetic_qa(document_id, workspace_id, &chunks).await?;
        }

        // Atualiza status para 'indexed'
        self.update_status(document_id, "indexed", None).await?;
        self.update_chunks_count(document_id, chunks.len() as i32).await?;

        Ok(PipelineResult {
            document_id,
            chunks_created: chunks.len(),
            extraction_method,
            chunking_strategy: strategy_name,
            language,
            has_tables,
        })
    }

    // ─── Helpers de banco ────────────────────────────────────────────────────────────────

    async fn update_status(
        &self,
        document_id: Uuid,
        status: &str,
        error: Option<&str>,
    ) -> Result<(), PipelineError> {
        sqlx::query!(
            r#"
            UPDATE documents
            SET processing_status = $2,
                processing_error = $3,
                processing_started_at = CASE WHEN $2 = 'processing' THEN NOW() ELSE processing_started_at END,
                indexed_at = CASE WHEN $2 = 'indexed' THEN NOW() ELSE indexed_at END
            WHERE id = $1
            "#,
            document_id,
            status,
            error,
        )
        .execute(&self.db)
        .await?;
        Ok(())
    }

    async fn update_chunks_count(
        &self,
        document_id: Uuid,
        count: i32,
    ) -> Result<(), PipelineError> {
        sqlx::query!(
            "UPDATE documents SET chunks_count = $2 WHERE id = $1",
            document_id,
            count,
        )
        .execute(&self.db)
        .await?;
        Ok(())
    }

    /// Persiste metadados dos chunks no PostgreSQL (para API de listagem)
    async fn persist_chunks_to_db(
        &self,
        chunks: &[crate::Chunk],
    ) -> Result<(), PipelineError> {
        for chunk in chunks {
            sqlx::query!(
                r#"
                INSERT INTO document_chunks
                    (id, document_id, workspace_id, chunk_index, content,
                     token_count, chunk_type, section_title)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT (id) DO NOTHING
                "#,
                chunk.id,
                chunk.document_id,
                chunk.workspace_id,
                chunk.chunk_index as i32,
                chunk.content,
                chunk.token_count as i32,
                format!("{:?}", chunk.chunk_type),
                chunk.section_title,
            )
            .execute(&self.db)
            .await?;
        }
        Ok(())
    }

    /// Cria registros de QA sintético pendentes de curadoria
    async fn enqueue_synthetic_qa(
        &self,
        document_id: Uuid,
        workspace_id: Uuid,
        chunks: &[crate::Chunk],
    ) -> Result<(), PipelineError> {
        // Insere chunks elegíveis como training_documents pendentes
        // A geração real do QA é feita pelo serviço Python `generate_synthetic_qa.py`
        // que vai ler esses registros e chamar o LLM para gerar perguntas
        for chunk in chunks.iter().take(20) {  // limita por doc para não sobrecarregar
            sqlx::query!(
                r#"
                INSERT INTO training_documents
                    (id, workspace_id, document_name, chunk_text, classification, curator_status)
                SELECT
                    gen_random_uuid(), $1,
                    d.filename, $3, $4, 'pending'
                FROM documents d WHERE d.id = $2
                ON CONFLICT DO NOTHING
                "#,
                workspace_id,
                document_id,
                chunk.content,
                "INTERNAL",
            )
            .execute(&self.db)
            .await?;
        }
        Ok(())
    }
}
