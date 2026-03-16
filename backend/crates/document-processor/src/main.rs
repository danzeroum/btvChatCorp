mod config;
mod extractor;
mod strategy;
mod chunker;
mod embedder;
mod indexer;

use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Semaphore;
use tracing::{error, info, warn};
use uuid::Uuid;

use config::Config;
use extractor::extract_text;
use strategy::detect_strategy;
use chunker::chunk_text;
use embedder::Embedder;
use indexer::Indexer;

#[derive(Debug, sqlx::FromRow)]
struct PendingDoc {
    id: Uuid,
    workspace_id: Uuid,
    storage_path: String,
    mime_type: String,
    original_filename: String,
    retry_count: i32,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("rag_worker=info".parse()?),
        )
        .init();

    let cfg = Config::from_env()?;
    info!("RAG Worker iniciando — concurrency={} poll={}s",
        cfg.worker_concurrency, cfg.poll_interval_secs);

    let db = PgPoolOptions::new()
        .max_connections(cfg.worker_concurrency as u32 + 2)
        .connect(&cfg.database_url)
        .await?;

    let embedder = Arc::new(Embedder::new(&cfg.embedding_url));
    let indexer  = Arc::new(Indexer::new(db.clone(), &cfg.qdrant_url).await?);
    let sem      = Arc::new(Semaphore::new(cfg.worker_concurrency));
    let cfg      = Arc::new(cfg);

    info!("Conectado ao banco. Iniciando loop de poll...");

    loop {
        match fetch_pending(&db, cfg.worker_concurrency as i64).await {
            Ok(docs) if docs.is_empty() => {
                tokio::time::sleep(Duration::from_secs(cfg.poll_interval_secs)).await;
            }
            Ok(docs) => {
                info!("Encontrados {} documentos pending", docs.len());
                let mut handles = Vec::new();

                for doc in docs {
                    let permit   = sem.clone().acquire_owned().await?;
                    let db2      = db.clone();
                    let emb      = embedder.clone();
                    let idx      = indexer.clone();
                    let cfg2     = cfg.clone();

                    let handle = tokio::spawn(async move {
                        let _permit = permit;
                        process_document(doc, db2, emb, idx, cfg2).await
                    });
                    handles.push(handle);
                }

                for h in handles {
                    if let Err(e) = h.await {
                        error!("Task panicked: {:?}", e);
                    }
                }
            }
            Err(e) => {
                error!("Erro ao buscar documentos pending: {}", e);
                tokio::time::sleep(Duration::from_secs(cfg.poll_interval_secs)).await;
            }
        }
    }
}

async fn fetch_pending(db: &sqlx::PgPool, limit: i64) -> Result<Vec<PendingDoc>> {
    // Usa SELECT ... FOR UPDATE SKIP LOCKED para evitar que dois workers
    // processem o mesmo documento em ambiente multi-instância
    let docs = sqlx::query_as::<_, PendingDoc>(
        r#"
        SELECT id, workspace_id, storage_path, mime_type,
               original_filename,
               COALESCE(retry_count, 0) AS retry_count
        FROM documents
        WHERE processing_status = 'pending'
          AND COALESCE(retry_count, 0) < $1
        ORDER BY created_at
        LIMIT $2
        FOR UPDATE SKIP LOCKED
        "#,
    )
    .bind(3i32)
    .bind(limit)
    .fetch_all(db)
    .await?;
    Ok(docs)
}

async fn process_document(
    doc: PendingDoc,
    db: sqlx::PgPool,
    embedder: Arc<Embedder>,
    indexer: Arc<Indexer>,
    cfg: Arc<Config>,
) {
    info!(doc_id = %doc.id, filename = %doc.original_filename, "Processando documento");

    // Marca como processing
    if let Err(e) = set_status(&db, doc.id, "processing", None).await {
        error!("Erro ao marcar processing: {}", e);
        return;
    }

    match run_pipeline(&doc, &db, &embedder, &indexer, &cfg).await {
        Ok(chunk_count) => {
            info!(doc_id = %doc.id, chunks = chunk_count, "Documento processado com sucesso");
            let _ = sqlx::query(
                "UPDATE documents
                 SET processing_status='completed', chunk_count=$1, updated_at=NOW()
                 WHERE id=$2",
            )
            .bind(chunk_count as i32)
            .bind(doc.id)
            .execute(&db)
            .await;
        }
        Err(e) => {
            let next_retry = doc.retry_count + 1;
            warn!(doc_id = %doc.id, retry = next_retry, "Erro no pipeline: {}", e);

            let next_status = if next_retry >= cfg.max_retries {
                "failed"
            } else {
                "pending" // volta para a fila
            };

            let _ = sqlx::query(
                "UPDATE documents
                 SET processing_status=$1, retry_count=$2,
                     error_message=$3, updated_at=NOW()
                 WHERE id=$4",
            )
            .bind(next_status)
            .bind(next_retry)
            .bind(e.to_string())
            .bind(doc.id)
            .execute(&db)
            .await;
        }
    }
}

async fn run_pipeline(
    doc: &PendingDoc,
    db: &sqlx::PgPool,
    embedder: &Embedder,
    indexer: &Indexer,
    cfg: &Config,
) -> Result<usize> {
    // 1. Extrai texto
    let full_path = format!("{}/{}", cfg.storage_path, doc.storage_path
        .split(['/', '\\']).last().unwrap_or(&doc.original_filename));
    let text = extract_text(&full_path, &doc.mime_type).await?;

    if text.trim().is_empty() {
        return Err(anyhow::anyhow!("Documento sem texto extraível"));
    }

    // 2. Detecta estratégia
    let strategy = detect_strategy(&text, &doc.original_filename, None);
    info!(doc_id = %doc.id, ?strategy, "Estratégia de chunking selecionada");

    // 3. Gera chunks
    let chunks = chunk_text(&text, &strategy);
    let total  = chunks.len();
    info!(doc_id = %doc.id, chunks = total, "Chunks gerados");

    // 4. Gera embeddings em batches de 32
    let texts: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
    let embeddings = embedder.embed_batch(&texts).await?;

    // 5. Indexa
    indexer.index_document(
        doc.id,
        doc.workspace_id,
        &doc.original_filename,
        chunks,
        embeddings,
        db,
    ).await?;

    Ok(total)
}

async fn set_status(
    db: &sqlx::PgPool,
    id: Uuid,
    status: &str,
    error: Option<&str>,
) -> Result<()> {
    sqlx::query(
        "UPDATE documents SET processing_status=$1, error_message=$2, updated_at=NOW() WHERE id=$3",
    )
    .bind(status)
    .bind(error)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}
