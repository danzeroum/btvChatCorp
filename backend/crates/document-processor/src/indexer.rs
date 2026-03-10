use crate::Chunk;
use anyhow::Result;
use uuid::Uuid;

pub struct DocumentIndexer {
    pub qdrant_url: String,
    pub collection_prefix: String,
}

impl DocumentIndexer {
    pub fn new(qdrant_url: String) -> Self {
        Self {
            qdrant_url,
            collection_prefix: "workspace".to_string(),
        }
    }

    /// Garante que a collection do workspace existe no Qdrant
    pub async fn ensure_collection(&self, workspace_id: Uuid, vector_size: u64) -> Result<()> {
        let client = reqwest::Client::new();
        let collection = format!("{}_{}" , self.collection_prefix, workspace_id);
        client
            .put(format!("{}/collections/{}", self.qdrant_url, collection))
            .json(&serde_json::json!({
                "vectors": {
                    "size": vector_size,
                    "distance": "Cosine"
                }
            }))
            .send().await?;
        Ok(())
    }

    /// Indexa um lote de chunks (com embeddings) no Qdrant
    pub async fn index_chunks(&self, chunks: &[Chunk]) -> Result<()> {
        if chunks.is_empty() { return Ok(()); }
        let workspace_id = chunks[0].workspace_id;
        let collection = format!("{}_{}" , self.collection_prefix, workspace_id);

        let points: Vec<serde_json::Value> = chunks.iter()
            .filter(|c| c.embedding.is_some())
            .map(|c| serde_json::json!({
                "id": c.id.to_string(),
                "vector": c.embedding,
                "payload": {
                    "document_id": c.document_id,
                    "workspace_id": c.workspace_id,
                    "chunk_index": c.chunk_index,
                    "content": c.content,
                    "section_title": c.section_title,
                    "token_count": c.token_count,
                }
            }))
            .collect();

        let client = reqwest::Client::new();
        client
            .put(format!("{}/collections/{}/points", self.qdrant_url, collection))
            .json(&serde_json::json!({ "points": points }))
            .send().await?;

        Ok(())
    }

    /// Busca os top-K chunks mais similares a um vetor de query
    pub async fn search(
        &self,
        workspace_id: Uuid,
        query_vector: Vec<f32>,
        top_k: usize,
        filter: Option<serde_json::Value>,
    ) -> Result<Vec<serde_json::Value>> {
        let collection = format!("{}_{}" , self.collection_prefix, workspace_id);
        let client = reqwest::Client::new();

        let mut body = serde_json::json!({
            "vector": query_vector,
            "limit": top_k,
            "with_payload": true,
            "with_vector": false
        });

        if let Some(f) = filter {
            body["filter"] = f;
        }

        let response: serde_json::Value = client
            .post(format!("{}/collections/{}/points/search", self.qdrant_url, collection))
            .json(&body)
            .send().await?
            .json().await?;

        Ok(response["result"].as_array().cloned().unwrap_or_default())
    }
}
