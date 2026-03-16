use anyhow::Result;
use serde_json::json;
use tracing::info;
use uuid::Uuid;

use crate::chunker::Chunk;

/// Responsável por persistir chunks no PostgreSQL e vetores no Qdrant.
pub struct Indexer {
    db:         sqlx::PgPool,
    qdrant_url: String,
    client:     reqwest::Client,
}

impl Indexer {
    pub async fn new(db: sqlx::PgPool, qdrant_url: &str) -> Result<Self> {
        let indexer = Self {
            db,
            qdrant_url: qdrant_url.to_string(),
            client: reqwest::Client::new(),
        };
        Ok(indexer)
    }

    /// Indexa todos os chunks de um documento:
    /// 1. Garante que a collection do workspace existe no Qdrant
    /// 2. Salva cada chunk na tabela `document_chunks` (PostgreSQL)
    /// 3. Faz upsert dos vetores no Qdrant
    pub async fn index_document(
        &self,
        doc_id:       Uuid,
        workspace_id: Uuid,
        filename:     &str,
        chunks:       Vec<Chunk>,
        embeddings:   Vec<Vec<f32>>,
        db:           &sqlx::PgPool,
    ) -> Result<()> {
        let collection = format!("workspace_{}", workspace_id.simple());

        // 1. Garante collection
        self.ensure_collection(&collection).await?;

        // 2. Salva no Postgres + monta payload para Qdrant
        let mut qdrant_points = Vec::with_capacity(chunks.len());

        for (chunk, embedding) in chunks.iter().zip(embeddings.iter()) {
            // Gera chunk_id determinístico
            let chunk_id = Uuid::new_v4();

            sqlx::query(
                r#"
                INSERT INTO document_chunks
                    (id, document_id, workspace_id, chunk_index,
                     section_title, content, token_count)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (document_id, chunk_index) DO UPDATE
                    SET content = EXCLUDED.content,
                        section_title = EXCLUDED.section_title,
                        updated_at = NOW()
                "#,
            )
            .bind(chunk_id)
            .bind(doc_id)
            .bind(workspace_id)
            .bind(chunk.index as i32)
            .bind(&chunk.section)
            .bind(&chunk.content)
            .bind(chunk.tokens as i32)
            .execute(db)
            .await?;

            // Payload rico para filtragem no Qdrant
            qdrant_points.push(json!({
                "id": chunk_id.to_string(),
                "vector": embedding,
                "payload": {
                    "doc_id":       doc_id.to_string(),
                    "workspace_id": workspace_id.to_string(),
                    "filename":     filename,
                    "section":      chunk.section,
                    "chunk_index":  chunk.index,
                    "content":      chunk.content,
                    "token_count":  chunk.tokens,
                }
            }));
        }

        // 3. Upsert em batch no Qdrant
        self.upsert_points(&collection, qdrant_points).await?;

        info!(
            doc_id = %doc_id,
            collection = %collection,
            chunks = chunks.len(),
            "Indexação concluída"
        );

        Ok(())
    }

    // ── Qdrant helpers ──────────────────────────────────────────────────────

    async fn ensure_collection(&self, collection: &str) -> Result<()> {
        let url = format!("{}/collections/{}", self.qdrant_url, collection);

        let resp = self.client.get(&url).send().await?;
        if resp.status().is_success() {
            return Ok(()); // já existe
        }

        // Cria a collection com vector size 768 (Nomic V2)
        let create_url = format!("{}/collections/{}", self.qdrant_url, collection);
        let body = json!({
            "vectors": {
                "size": 768,
                "distance": "Cosine"
            },
            "optimizers_config": {
                "indexing_threshold": 10000
            }
        });

        self.client
            .put(&create_url)
            .json(&body)
            .send()
            .await?
            .error_for_status()?;

        info!("Collection '{}' criada no Qdrant (dim=768, Cosine)", collection);
        Ok(())
    }

    async fn upsert_points(
        &self,
        collection: &str,
        points: Vec<serde_json::Value>,
    ) -> Result<()> {
        if points.is_empty() {
            return Ok(());
        }

        let url  = format!("{}/collections/{}/points", self.qdrant_url, collection);
        let body = json!({ "points": points });

        self.client
            .put(&url)
            .json(&body)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }
}
