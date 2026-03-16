use anyhow::Result;
use serde::{Deserialize, Serialize};
use tracing::info;

const BATCH_SIZE: usize = 32;

/// Cliente para o serviço Python de embedding (Nomic Embed V2).
pub struct Embedder {
    client:        reqwest::Client,
    embedding_url: String,
}

#[derive(Serialize)]
struct EmbedRequest {
    texts: Vec<String>,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

impl Embedder {
    pub fn new(embedding_url: &str) -> Self {
        Self {
            client:        reqwest::Client::new(),
            embedding_url: embedding_url.to_string(),
        }
    }

    /// Gera embeddings para uma lista de textos, em batches de `BATCH_SIZE`.
    /// Adiciona o prefixo `search_document:` conforme recomendado pelo Nomic V2.
    pub async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let mut all_embeddings = Vec::with_capacity(texts.len());

        for (batch_idx, batch) in texts.chunks(BATCH_SIZE).enumerate() {
            let prefixed: Vec<String> = batch
                .iter()
                .map(|t| format!("search_document: {}", t))
                .collect();

            let resp = self
                .client
                .post(format!("{}/embed", self.embedding_url))
                .json(&EmbedRequest { texts: prefixed })
                .send()
                .await?
                .error_for_status()?
                .json::<EmbedResponse>()
                .await?;

            info!(
                "Batch {} — {} embeddings gerados (dim={})",
                batch_idx,
                resp.embeddings.len(),
                resp.embeddings.first().map(|e| e.len()).unwrap_or(0)
            );

            all_embeddings.extend(resp.embeddings);
        }

        Ok(all_embeddings)
    }
}
