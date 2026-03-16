use anyhow::{Result, Context};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::models::Chunk;

// ---------------------------------------------------------------------------
// Request / Response do serviço de embedding (Nomic Embed V2 via Python)
// Compatible com a API OpenAI /v1/embeddings
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct EmbedRequest<'a> {
    texts: &'a [String],
    /// Prefixo de tarefa para Nomic Embed V2
    task_type: &'a str,  // "search_document" ou "search_query"
}

#[derive(Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

// ---------------------------------------------------------------------------
// Embedder
// ---------------------------------------------------------------------------

pub struct Embedder {
    client: Client,
    embedding_url: String,
    /// Tamanho de batch para chamadas ao serviço (limite de memória GPU)
    batch_size: usize,
}

impl Embedder {
    pub fn new(embedding_url: impl Into<String>) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .expect("reqwest client"),
            embedding_url: embedding_url.into(),
            batch_size: 32,
        }
    }

    /// Gera embeddings para todos os chunks em batches
    pub async fn embed_chunks(&self, chunks: &mut Vec<Chunk>) -> Result<()> {
        info!("Gerando embeddings para {} chunks", chunks.len());
        let total = chunks.len();
        let mut done = 0usize;

        // Processa em batches
        for batch_start in (0..total).step_by(self.batch_size) {
            let batch_end = (batch_start + self.batch_size).min(total);
            let texts: Vec<String> = chunks[batch_start..batch_end]
                .iter()
                .map(|c| self.prepare_for_embedding(c))
                .collect();

            let embeddings = self
                .get_embeddings_batch(&texts)
                .await
                .with_context(|| format!("Batch {batch_start}..{batch_end}"))?;

            for (i, embedding) in embeddings.into_iter().enumerate() {
                chunks[batch_start + i].embedding = Some(embedding);
            }
            done += batch_end - batch_start;
            info!("  Embeddings: {done}/{total}");
        }
        Ok(())
    }

    /// Gera embedding para uma única query (tempo real, prefixo diferente)
    pub async fn embed_query(&self, query: &str) -> Result<Vec<f32>> {
        let texts = vec![format!("search_query: {query}")];
        let mut embeddings = self
            .get_embeddings_batch(&texts)
            .await?;
        embeddings
            .pop()
            .ok_or_else(|| anyhow::anyhow!("embedding service retornou resposta vazia"))
    }

    // -----------------------------------------------------------------------
    // Prepara texto com prefixo Nomic Embed V2 para melhor retrieval
    // -----------------------------------------------------------------------
    fn prepare_for_embedding(&self, chunk: &Chunk) -> String {
        let prefix = "search_document";
        match &chunk.section_title {
            Some(title) => format!("{prefix}: {title}\n{}", chunk.content),
            None        => format!("{prefix}: {}", chunk.content),
        }
    }

    async fn get_embeddings_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let url = format!("{}/embed", self.embedding_url);
        let resp: EmbedResponse = self
            .client
            .post(&url)
            .json(&EmbedRequest {
                texts,
                task_type: "search_document",
            })
            .send()
            .await
            .context("embedding service unreachable")?;

        // Verifica status HTTP antes de desserializar
        let resp = resp;
        Ok(resp.embeddings)
    }
}

// Newtype para desserializar resposta HTTP com verificação de status
impl Embedder {
    async fn post_json<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
        body: &impl Serialize,
    ) -> Result<T> {
        let response = self
            .client
            .post(url)
            .json(body)
            .send()
            .await
            .context("HTTP request failed")?;

        let status = response.status();
        if !status.is_success() {
            let text = response.text().await.unwrap_or_default();
            anyhow::bail!("embedding service error {status}: {text}");
        }
        response.json::<T>().await.context("JSON deserialize")
    }
}
