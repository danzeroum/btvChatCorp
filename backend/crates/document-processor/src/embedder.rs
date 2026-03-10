use crate::Chunk;
use anyhow::Result;

pub struct EmbeddingService {
    pub service_url: String,
    pub model: String,
}

impl EmbeddingService {
    pub fn new(service_url: String) -> Self {
        Self {
            service_url,
            model: "nomic-embed-text-v2".to_string(),
        }
    }

    /// Gera embeddings para um lote de chunks via Nomic Embed V2
    pub async fn embed_chunks(&self, chunks: Vec<Chunk>) -> Result<Vec<Chunk>> {
        let texts: Vec<&str> = chunks.iter().map(|c| c.content.as_str()).collect();
        let client = reqwest::Client::new();
        let response: serde_json::Value = client
            .post(format!("{}/embed", self.service_url))
            .json(&serde_json::json!({
                "model": self.model,
                "texts": texts,
                "task": "retrieval.passage"
            }))
            .send().await?
            .json().await?;

        let embeddings = response["embeddings"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("No embeddings in response"))?;

        let result = chunks.into_iter().enumerate().map(|(i, mut chunk)| {
            if let Some(emb) = embeddings.get(i) {
                chunk.embedding = emb.as_array().map(|arr| {
                    arr.iter().filter_map(|v| v.as_f64().map(|f| f as f32)).collect()
                });
            }
            chunk
        }).collect();

        Ok(result)
    }

    /// Gera embedding para uma query (busca)
    pub async fn embed_query(&self, query: &str) -> Result<Vec<f32>> {
        let client = reqwest::Client::new();
        let response: serde_json::Value = client
            .post(format!("{}/embed", self.service_url))
            .json(&serde_json::json!({
                "model": self.model,
                "texts": [query],
                "task": "retrieval.query"
            }))
            .send().await?
            .json().await?;

        let embedding = response["embeddings"][0]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("No embedding in response"))?
            .iter()
            .filter_map(|v| v.as_f64().map(|f| f as f32))
            .collect();

        Ok(embedding)
    }
}
