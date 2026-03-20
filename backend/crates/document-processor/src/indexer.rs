use anyhow::Result;
use serde_json::json;
use tracing::info;
use uuid::Uuid;

use crate::chunker::Chunk;

/// Respons\u{e1}vel por persistir chunks no PostgreSQL e vetores no Qdrant.
pub struct Indexer {
    qdrant_url: String,
    client: reqwest::Client,
}

impl Indexer {
    pub fn new(qdrant_url: &str) -> Self {
        Self {
            qdrant_url: qdrant_url.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Pipeline de index\u{e3}o:
    /// 1. Persiste chunks no PostgreSQL
    /// 2. Garante que a collection Qdrant existe
    /// 3. Faz upsert dos vetores no Qdrant
    pub async fn index_document(
        &self,
        doc_id: Uuid,
        workspace_id: Uuid,
        filename: &str,
        chunks: Vec<Chunk>,
        embeddings: Vec<Vec<f32>>,
        db: &sqlx::PgPool,
    ) -> Result<()> {
        let collection = format!("workspace_{}", workspace_id.simple());

        // 1. Persiste no PostgreSQL
        for (chunk, _embedding) in chunks.iter().zip(embeddings.iter()) {
            let point_id = Uuid::new_v4().to_string();
            sqlx::query(
                r#"
                INSERT INTO document_chunks
                    (document_id, workspace_id, chunk_index, section_title,
                     content, token_count, embedding_status, qdrant_point_id, indexed_at)
                VALUES ($1, $2, $3, $4, $5, $6, 'indexed', $7, NOW())
                ON CONFLICT (document_id, chunk_index)
                DO UPDATE SET
                    content          = EXCLUDED.content,
                    token_count      = EXCLUDED.token_count,
                    embedding_status = 'indexed',
                    qdrant_point_id  = EXCLUDED.qdrant_point_id,
                    indexed_at       = NOW()
                "#,
            )
            .bind(doc_id)
            .bind(workspace_id)
            .bind(chunk.index as i32)
            .bind(&chunk.section)
            .bind(&chunk.content)
            .bind(chunk.tokens as i32)
            .bind(&point_id)
            .execute(db)
            .await?;
        }

        // 2. Garante collection no Qdrant
        self.ensure_collection(&collection).await?;

        // 3. Upsert vetores
        let points: Vec<serde_json::Value> = chunks
            .iter()
            .zip(embeddings.iter())
            .map(|(chunk, emb)| {
                json!({
                    "id":      Uuid::new_v4().to_string(),
                    "vector":  emb,
                    "payload": {
                        "doc_id":       doc_id.to_string(),
                        "workspace_id": workspace_id.to_string(),
                        "filename":     filename,
                        "section":      &chunk.section,
                        "chunk_index":  chunk.index,
                        "content":      &chunk.content,
                    }
                })
            })
            .collect();

        self.upsert_points(&collection, points).await?;
        info!(
            "Indexados {} chunks do documento {} na collection {}",
            chunks.len(),
            doc_id,
            collection
        );
        Ok(())
    }

    async fn ensure_collection(&self, collection: &str) -> Result<()> {
        let check_url = format!("{}/collections/{}", self.qdrant_url, collection);
        let resp = self.client.get(&check_url).send().await?;
        if resp.status().is_success() {
            return Ok(());
        }
        let create_url = format!("{}/collections/{}", self.qdrant_url, collection);
        self.client
            .put(&create_url)
            .json(&json!({
                "vectors": {
                    "size":     768,
                    "distance": "Cosine"
                }
            }))
            .send()
            .await?
            .error_for_status()?;

        info!(
            "Collection '{}' criada no Qdrant (dim=768, Cosine)",
            collection
        );
        Ok(())
    }

    async fn upsert_points(&self, collection: &str, points: Vec<serde_json::Value>) -> Result<()> {
        if points.is_empty() {
            return Ok(());
        }

        let url = format!("{}/collections/{}/points", self.qdrant_url, collection);
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
