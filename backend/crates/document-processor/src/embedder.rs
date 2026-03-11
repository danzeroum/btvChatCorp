use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::{errors::IndexError, Chunk};

#[derive(Debug, Serialize)]
struct EmbedRequest {
    texts: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

pub struct Embedder {
    pub embedding_url: String,
    pub http: Client,
    pub batch_size: usize,
}

impl Embedder {
    pub fn new(embedding_url: impl Into<String>) -> Self {
        Self {
            embedding_url: embedding_url.into(),
            http: Client::new(),
            batch_size: 32,
        }
    }

    /// Gera embeddings para todos os chunks em batches de 32
    /// Usa prefixo `search_document:` exigido pelo Nomic Embed V2
    pub async fn embed_chunks(&self, chunks: &mut Vec<Chunk>) -> Result<(), IndexError> {
        let texts: Vec<String> = chunks
            .iter()
            .map(|c| self.prepare_for_embedding(c))
            .collect();

        let embeddings = self.get_embeddings_batch(texts).await?;

        for (chunk, embedding) in chunks.iter_mut().zip(embeddings.into_iter()) {
            chunk.embedding = Some(embedding);
        }
        Ok(())
    }

    /// Prepara texto para embedding: adiciona prefixo contextual do Nomic V2
    fn prepare_for_embedding(&self, chunk: &Chunk) -> String {
        let prefix = "search_document:";
        match &chunk.section_title {
            Some(title) => format!("{} {} | {}", prefix, title, chunk.content),
            None => format!("{} {}", prefix, chunk.content),
        }
    }

    /// Chama o serviço de embedding em batches de `batch_size`
    pub async fn get_embeddings_batch(
        &self,
        texts: Vec<String>,
    ) -> Result<Vec<Vec<f32>>, IndexError> {
        let mut all_embeddings: Vec<Vec<f32>> = Vec::new();

        for batch in texts.chunks(self.batch_size) {
            let response: EmbedResponse = self
                .http
                .post(format!("{}/embed", self.embedding_url))
                .json(&EmbedRequest { texts: batch.to_vec() })
                .send()
                .await
                .map_err(IndexError::Http)?
                .json()
                .await
                .map_err(|e| IndexError::EmbeddingService(e.to_string()))?;

            all_embeddings.extend(response.embeddings);
        }
        Ok(all_embeddings)
    }

    /// Gera embedding de uma única query (com prefixo diferente para busca)
    pub async fn embed_query(&self, query: &str) -> Result<Vec<f32>, IndexError> {
        let prefixed = format!("search_query: {}", query);
        let response: EmbedResponse = self
            .http
            .post(format!("{}/embed", self.embedding_url))
            .json(&EmbedRequest { texts: vec![prefixed] })
            .send()
            .await
            .map_err(IndexError::Http)?
            .json()
            .await
            .map_err(|e| IndexError::EmbeddingService(e.to_string()))?;

        response
            .embeddings
            .into_iter()
            .next()
            .ok_or_else(|| IndexError::EmbeddingService("Empty embedding response".into()))
    }
}
