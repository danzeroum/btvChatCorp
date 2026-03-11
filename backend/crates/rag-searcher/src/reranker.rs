use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::errors::SearchError;

#[derive(Debug, Serialize)]
struct RerankRequest<'a> {
    query: &'a str,
    documents: Vec<&'a str>,
}

#[derive(Debug, Deserialize)]
struct RerankResponse {
    scores: Vec<f32>,
}

pub struct Reranker {
    pub reranker_url: String,
    pub http: Client,
}

impl Reranker {
    pub fn new(reranker_url: impl Into<String>) -> Self {
        Self {
            reranker_url: reranker_url.into(),
            http: Client::new(),
        }
    }

    /// Envia pares (query, doc) para o cross-encoder e retorna scores de relevância.
    /// O serviço Python usa `cross-encoder/ms-marco-MiniLM-L-12-v2`.
    pub async fn rerank(
        &self,
        query: &str,
        documents: &[&str],
    ) -> Result<Vec<f32>, SearchError> {
        if documents.is_empty() {
            return Ok(vec![]);
        }

        let response: RerankResponse = self
            .http
            .post(format!("{}/rerank", self.reranker_url))
            .json(&RerankRequest { query, documents })
            .send()
            .await
            .map_err(SearchError::Http)?
            .json()
            .await
            .map_err(SearchError::Http)?;

        Ok(response.scores)
    }
}
