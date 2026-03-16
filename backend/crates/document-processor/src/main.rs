//! RAG Worker — processa documentos `pending` e os indexa no Qdrant
//!
//! Variáveis de ambiente obrigatórias:
//!   DATABASE_URL       postgres://...
//!   QDRANT_URL         http://localhost:6333
//!   EMBEDDING_URL      http://localhost:8001   (serviço Python Nomic V2)
//!   STORAGE_PATH       /data/uploads           (onde os arquivos ficam armazenados)
//!
//! Comportamento:
//!   - Poll a cada POLL_INTERVAL_SECS (default 10s) por documentos `pending`
//!   - Processa em paralelo até WORKER_CONCURRENCY documentos (default 4)
//!   - Em caso de falha: marca documento como `failed`, salva mensagem de erro
//!   - Documentos `failed` são retentados até MAX_RETRIES vezes

use std::env;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use sqlx::PgPool;
use tokio::time::sleep;
use tracing::{error, info, warn};
use uuid::Uuid;

use document_processor::{
    chunker::IntelligentChunker,
    embedder::Embedder,
    extractor::TextExtractor,
    indexer::DocumentIndexer,
    models::{DataClassification, RawDocument},
    strategy::StrategySelector,
};

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

struct Config {
    database_url: String,
    qdrant_url: String,
    embedding_url: String,
    storage_path: PathBuf,
    poll_interval_secs: u64,
    worker_concurrency: usize,
    max_retries: i32,
}

impl Config {
    fn from_env() -> Self {
        Self {
            database_url:       env::var("DATABASE_URL").expect("DATABASE_URL obrigatorio"),
            qdrant_url:         env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".into()),
            embedding_url:      env::var("EMBEDDING_URL").unwrap_or_else(|_| "http://localhost:8001".into()),
            storage_path:       PathBuf::from(env::var("STORAGE_PATH").unwrap_or_else(|_| "/data/uploads".into())),
            poll_interval_secs: env::var("POLL_INTERVAL_SECS").ok().and_then(|v| v.parse().ok()).unwrap_or(10),
            worker_concurrency: env::var("WORKER_CONCURRENCY").ok().and_then(|v| v.parse().ok()).unwrap_or(4),
            max_retries:        env::var("MAX_RETRIES").ok().and_then(|v| v.parse().ok()).unwrap_or(3),
        }
    }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<()> {
    // Logging estruturado
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("rag_worker=info".parse().unwrap()),
        )
        .init();

    let cfg = Arc::new(Config::from_env());
    info!("RAG Worker iniciando");
    info!("  DB:        {}", &cfg.database_url[..cfg.database_url.find('@').unwrap_or(20)]);
    info!("  Qdrant:    {}", cfg.qdrant_url);
    info!("  Embedding: {}", cfg.embedding_url);
    info!("  Storage:   {:?}", cfg.storage_path);
    info!("  Concorrencia: {}", cfg.worker_concurrency);

    let pool = PgPool::connect(&cfg.database_url).await?;
    let embedder  = Arc::new(Embedder::new(&cfg.embedding_url));
    let indexer   = Arc::new(DocumentIndexer::new(&cfg.qdrant_url)?);
    let semaphore = Arc::new(tokio::sync::Semaphore::new(cfg.worker_concurrency));

    loop {
        match fetch_pending_documents(&pool, cfg.max_retries, 20).await {
            Ok(docs) if docs.is_empty() => {
                // Nada a fazer; aguarda próximo ciclo
            }
            Ok(docs) => {
                info!("{} documento(s) para processar", docs.len());
                let mut handles = Vec::new();

                for doc in docs {
                    let pool      = pool.clone();
                    let embedder  = Arc::clone(&embedder);
                    let indexer   = Arc::clone(&indexer);
                    let sem       = Arc::clone(&semaphore);
                    let storage   = cfg.storage_path.clone();

                    let handle = tokio::spawn(async move {
                        let _permit = sem.acquire().await.unwrap();
                        if let Err(e) = process_document(&pool, &embedder, &indexer, &storage, &doc).await {
                            error!("Falha ao processar doc {}: {e:#}", doc.id);
                            mark_failed(&pool, doc.id, &e.to_string()).await.ok();
                        }
                    });
                    handles.push(handle);
                }

                for h in handles { h.await.ok(); }
            }
            Err(e) => {
                error!("Erro ao buscar documentos pendentes: {e:#}");
            }
        }

        sleep(Duration::from_secs(cfg.poll_interval_secs)).await;
    }
}

// ---------------------------------------------------------------------------
// Processamento de um documento
// ---------------------------------------------------------------------------

async fn process_document(
    pool: &PgPool,
    embedder: &Embedder,
    indexer: &DocumentIndexer,
    storage_path: &PathBuf,
    doc: &RawDocument,
) -> Result<()> {
    info!("Processando: {} ({})", doc.original_filename, doc.id);

    // 1. Marca como `processing`
    mark_processing(pool, doc.id).await?;

    // 2. Caminho do arquivo no storage local
    let filepath = storage_path.join(&doc.storage_path);

    // 3. Extração de texto
    let extracted = TextExtractor::extract(&filepath, &doc.mime_type).await?;
    info!("  Texto extraído: {} chars, {} seções", extracted.raw_text.len(), extracted.sections.len());

    // 4. Seleção de estratégia baseada no conteúdo
    let sector = get_workspace_sector(pool, doc.workspace_id).await.unwrap_or_default();
    let strategy = StrategySelector::select(&extracted, &sector);
    info!("  Estratégia de chunking: {strategy:?}");

    // 5. Chunking inteligente
    let mut chunks = IntelligentChunker::chunk(&extracted, strategy, doc.id, doc.workspace_id);
    info!("  Chunks gerados: {}", chunks.len());

    if chunks.is_empty() {
        warn!("Documento {} não gerou chunks, marcando como completed", doc.id);
        mark_completed(pool, doc.id, 0).await?;
        return Ok(());
    }

    // 6. Gera embeddings (Nomic Embed V2)
    embedder.embed_chunks(&mut chunks).await?;

    // 7. Persiste chunks no PostgreSQL (para auditoria e context retrieval)
    save_chunks_to_db(pool, &chunks).await?;

    // 8. Indexa no Qdrant
    indexer.index_document(&chunks, doc.workspace_id).await?;

    // 9. Marca documento como `completed`
    mark_completed(pool, doc.id, chunks.len() as i32).await?;
    info!("  ✅ Documento {} indexado com {} chunks", doc.id, chunks.len());

    Ok(())
}

// ---------------------------------------------------------------------------
// Queries SQL
// ---------------------------------------------------------------------------

async fn fetch_pending_documents(
    pool: &PgPool,
    max_retries: i32,
    limit: i64,
) -> Result<Vec<RawDocument>> {
    // Usamos um advisory lock leve: só busca docs que não estão sendo processados
    let rows = sqlx::query!(
        r#"
        SELECT id, workspace_id, filename, original_filename,
               mime_type, storage_path, processing_status
        FROM documents
        WHERE processing_status IN ('pending', 'failed')
          AND (retry_count IS NULL OR retry_count < $1)
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
        "#,
        max_retries,
        limit,
    )
    .fetch_all(pool)
    .await?;

    let docs = rows
        .into_iter()
        .map(|r| RawDocument {
            id: r.id,
            workspace_id: r.workspace_id,
            filename: r.filename,
            original_filename: r.original_filename,
            mime_type: r.mime_type,
            storage_path: r.storage_path,
            classification: DataClassification::Internal, // padrão; pode vir do DB
            use_for_training: true,
        })
        .collect();
    Ok(docs)
}

async fn get_workspace_sector(pool: &PgPool, workspace_id: Uuid) -> Result<String> {
    let row = sqlx::query!(
        "SELECT sector FROM workspaces WHERE id = $1",
        workspace_id
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|r| r.sector).unwrap_or_default())
}

async fn mark_processing(pool: &PgPool, doc_id: Uuid) -> Result<()> {
    sqlx::query!(
        "UPDATE documents SET processing_status = 'processing', updated_at = NOW() WHERE id = $1",
        doc_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn mark_completed(pool: &PgPool, doc_id: Uuid, chunk_count: i32) -> Result<()> {
    sqlx::query!(
        "UPDATE documents SET processing_status = 'completed', chunk_count = $2, updated_at = NOW() WHERE id = $1",
        doc_id,
        chunk_count
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn mark_failed(pool: &PgPool, doc_id: Uuid, error_msg: &str) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE documents
        SET processing_status = 'failed',
            retry_count = COALESCE(retry_count, 0) + 1,
            updated_at = NOW()
        WHERE id = $1
        "#,
        doc_id,
    )
    .execute(pool)
    .await?;
    // Salva log de erro nos chunks em estado 'processing' desse doc (se houver)
    sqlx::query!(
        "UPDATE document_chunks SET embedding_status = 'failed', error_message = $2 WHERE document_id = $1 AND embedding_status = 'processing'",
        doc_id,
        error_msg,
    )
    .execute(pool)
    .await
    .ok();
    Ok(())
}

async fn save_chunks_to_db(pool: &PgPool, chunks: &[crate::models::Chunk]) -> Result<()> {
    use crate::models::Chunk;
    for chunk in chunks {
        sqlx::query!(
            r#"
            INSERT INTO document_chunks
                (id, document_id, workspace_id, content, chunk_index, total_chunks,
                 section_title, page_number, chunk_type, token_count,
                 previous_chunk_id, next_chunk_id,
                 embedding_status, qdrant_point_id, indexed_at)
            VALUES
                ($1, $2, $3, $4, $5, $6,
                 $7, $8, $9, $10,
                 $11, $12,
                 'indexed', $1, NOW())
            ON CONFLICT (id) DO UPDATE
              SET embedding_status = 'indexed',
                  indexed_at = NOW()
            "#,
            chunk.id,
            chunk.document_id,
            chunk.workspace_id,
            chunk.content,
            chunk.chunk_index as i32,
            chunk.total_chunks as i32,
            chunk.section_title,
            chunk.page_number.map(|p| p as i32),
            chunk.chunk_type.to_string(),
            chunk.token_count as i32,
            chunk.previous_chunk_id,
            chunk.next_chunk_id,
        )
        .execute(pool)
        .await?;
    }
    Ok(())
}
