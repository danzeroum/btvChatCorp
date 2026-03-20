use anyhow::Result;
use tracing::info;

/// Cliente para o servi\u{e7}o Python de embedding (Nomic Embed V2).
pub struct Embedder {
    client: reqwest::Client,
    embedding_url: String,
}

#[derive(serde::Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

impl Embedder {
    pub fn new(embedding_url: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            embedding_url: embedding_url.to_string(),
        }
    }

    /// Envia at\u{e9} 32 textos por batch e retorna os vetores.
    pub async fn embed_batch(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        let mut all = Vec::new();
        for batch in texts.chunks(32) {
            let prefixed: Vec<String> = batch
                .iter()
                .map(|t| format!("search_document: {}", t))
                .collect();
            let resp: EmbedResponse = self
                .client
                .post(format!("{}/embed", self.embedding_url))
                .json(&serde_json::json!({ "texts": prefixed }))
                .send()
                .await?
                .json()
                .await?;
            info!("Batch de {} embeddings recebido", resp.embeddings.len());
            all.extend(resp.embeddings);
        }
        Ok(all)
    }
}
