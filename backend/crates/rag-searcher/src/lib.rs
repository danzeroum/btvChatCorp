//! rag-searcher — busca vetorial no Qdrant com reranking.
//!
//! Este crate e responsavel por:
//!   1. Vetorizar a query do usuario via embedding service
//!   2. Buscar chunks relevantes no Qdrant (payload filter por workspace_id)
//!   3. Rerankar resultados com cross-encoder (opcional)
//!   4. Retornar lista de RAGSource com score e conteudo
//!
//! Status: stub funcional — implementacao completa na Sprint 5.

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct RAGSource {
    pub chunk_id:    String,
    pub document_id: String,
    pub content:     String,
    pub score:       f32,
    pub page:        Option<u32>,
}

#[derive(Debug, Clone)]
pub struct RAGSearcher {
    pub qdrant_url:    String,
    pub embedding_url: String,
    pub http:          reqwest::Client,
}

impl RAGSearcher {
    pub fn new(qdrant_url: &str, embedding_url: &str) -> Self {
        Self {
            qdrant_url:    qdrant_url.to_string(),
            embedding_url: embedding_url.to_string(),
            http:          reqwest::Client::new(),
        }
    }

    /// Busca chunks relevantes para a query no workspace especificado.
    pub async fn search(
        &self,
        workspace_id: &str,
        query: &str,
        top_k: usize,
    ) -> anyhow::Result<Vec<RAGSource>> {
        // 1. Gerar embedding da query
        let embed_resp = self
            .http
            .post(format!("{}/embed", self.embedding_url))
            .json(&serde_json::json!({ "texts": [query] }))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let vector: Vec<f32> = embed_resp["embeddings"][0]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_f64().map(|f| f as f32))
            .collect();

        // 2. Buscar no Qdrant com filtro de workspace
        let search_resp = self
            .http
            .post(format!(
                "{}/collections/{}/points/search",
                self.qdrant_url, workspace_id
            ))
            .json(&serde_json::json!({
                "vector": vector,
                "limit": top_k,
                "with_payload": true,
                "score_threshold": 0.5
            }))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let results = search_resp["result"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .map(|r| RAGSource {
                chunk_id:    r["id"].as_str().unwrap_or("").to_string(),
                document_id: r["payload"]["document_id"].as_str().unwrap_or("").to_string(),
                content:     r["payload"]["content"].as_str().unwrap_or("").to_string(),
                score:       r["score"].as_f64().unwrap_or(0.0) as f32,
                page:        r["payload"]["page"].as_u64().map(|p| p as u32),
            })
            .collect();

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rag_source_serialization() {
        let source = RAGSource {
            chunk_id:    "chunk-001".to_string(),
            document_id: "doc-001".to_string(),
            content:     "conteudo de teste".to_string(),
            score:       0.92,
            page:        Some(3),
        };
        let json = serde_json::to_string(&source).unwrap();
        assert!(json.contains("chunk-001"));
        assert!(json.contains("0.92"));
    }

    #[test]
    fn test_rag_searcher_new() {
        let searcher = RAGSearcher::new("http://qdrant:6333", "http://embedding:8001");
        assert_eq!(searcher.qdrant_url, "http://qdrant:6333");
        assert_eq!(searcher.embedding_url, "http://embedding:8001");
    }
}
