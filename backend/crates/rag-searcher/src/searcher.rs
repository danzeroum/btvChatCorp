use std::time::Instant;

use qdrant_client::{
    Qdrant,
    qdrant::{Filter, Condition, SearchPointsBuilder},
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    context_expander::ContextExpander,
    dedup::deduplicate,
    errors::SearchError,
    reranker::Reranker,
};

// ─── Tipos públicos ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievedChunk {
    pub content: String,
    /// Similaridade cosseno (Qdrant)
    pub score: f32,
    /// Score do cross-encoder (re-ranker)
    pub rerank_score: f32,
    pub document_id: String,
    pub section_title: Option<String>,
    pub chunk_type: String,
    pub chunk_index: u32,
    /// Contexto expandido: chunk anterior
    pub context_before: Option<String>,
    /// Contexto expandido: chunk posterior
    pub context_after: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagResult {
    pub chunks: Vec<RetrievedChunk>,
    pub total_candidates: usize,
    pub search_time_ms: u64,
}

#[derive(Debug, Clone, Default)]
pub struct SearchFilters {
    /// Restringe busca a um documento específico
    pub document_id: Option<String>,
    /// Filtra por tipo de chunk (legal, medical, paragraph…)
    pub chunk_type: Option<String>,
}

/// Configuração de busca RAG — personalizável por setor
#[derive(Debug, Clone)]
pub struct SearchConfig {
    /// Quantos candidatos buscar no Qdrant antes do rerank (sempre > top_k)
    pub initial_candidates: usize,
    /// Número final de chunks a retornar
    pub top_k: usize,
    /// Se true, chama cross-encoder para reranking
    pub rerank: bool,
    /// Se true, expande cada chunk com vizinhos
    pub expand_context: bool,
    /// Score mínimo de similaridade cosseno (0..1)
    pub min_score: f32,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            initial_candidates: 20,
            top_k: 5,
            rerank: true,
            expand_context: true,
            min_score: 0.3,
        }
    }
}

impl SearchConfig {
    /// Configurações recomendadas por setor (conforme documentação do projeto)
    pub fn for_sector(sector: &str, top_k: Option<usize>) -> Self {
        match sector {
            "legal" | "juridico" => Self {
                initial_candidates: 20,
                top_k: top_k.unwrap_or(6),
                rerank: true,
                expand_context: true,
                min_score: 0.3,
            },
            "health" | "saude" | "medical" => Self {
                initial_candidates: 15,
                top_k: top_k.unwrap_or(5),
                rerank: true,
                expand_context: true,
                min_score: 0.35,
            },
            "finance" | "fintech" => Self {
                initial_candidates: 15,
                top_k: top_k.unwrap_or(4),
                rerank: false,
                expand_context: false,
                min_score: 0.4,
            },
            _ => Self {
                initial_candidates: 20,
                top_k: top_k.unwrap_or(5),
                rerank: false,
                expand_context: true,
                min_score: 0.3,
            },
        }
    }
}

// ─── Tipos internos para embedding ────────────────────────────────────────────────────

#[derive(Serialize)]
struct EmbedRequest {
    texts: Vec<String>,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

// ─── RagSearcher principal ─────────────────────────────────────────────────────────────

pub struct RagSearcher {
    pub qdrant: Qdrant,
    pub embedding_url: String,
    pub reranker: Reranker,
    pub expander: ContextExpander,
    pub http: Client,
}

impl RagSearcher {
    pub fn new(
        qdrant_url: &str,
        embedding_url: impl Into<String>,
        reranker_url: impl Into<String>,
    ) -> Result<Self, SearchError> {
        let qdrant = Qdrant::from_url(qdrant_url)
            .build()
            .map_err(|e| SearchError::Qdrant(e.to_string()))?;

        // Cria Qdrant separado para o expander (Arc seria melhor em prod)
        let qdrant_exp = Qdrant::from_url(qdrant_url)
            .build()
            .map_err(|e| SearchError::Qdrant(e.to_string()))?;

        let reranker_url_str = reranker_url.into();
        let embedding_url_str = embedding_url.into();

        Ok(Self {
            qdrant,
            embedding_url: embedding_url_str.clone(),
            reranker: Reranker::new(reranker_url_str),
            expander: ContextExpander::new(qdrant_exp),
            http: Client::new(),
        })
    }

    // ─── Busca principal: 4 estágios ─────────────────────────────────────────────────

    /// Busca completa com 4 estágios:
    /// 1. Busca vetorial (Qdrant, top-N candidatos)
    /// 2. Expansão de contexto (chunks vizinhos)
    /// 3. Re-ranking (cross-encoder)
    /// 4. Deduplicação
    pub async fn search(
        &self,
        query: &str,
        workspace_id: Uuid,
        top_k: usize,
        filters: Option<SearchFilters>,
        config: Option<SearchConfig>,
    ) -> Result<RagResult, SearchError> {
        let start = Instant::now();
        let collection = format!("workspace_{}", workspace_id);
        let cfg = config.unwrap_or_else(|| SearchConfig {
            top_k,
            ..Default::default()
        });

        tracing::info!(
            workspace_id = %workspace_id,
            query = %&query[..query.len().min(80)],
            top_k = cfg.top_k,
            rerank = cfg.rerank,
            "RAG search started"
        );

        // ── Estágio 1: Busca vetorial ────────────────────────────────────────────
        let query_embedding = self.embed_query(query).await?;
        let qdrant_filter = Self::build_filter(&filters);

        let mut search_builder =
            SearchPointsBuilder::new(&collection, query_embedding, cfg.initial_candidates as u64)
                .with_payload(true)
                .score_threshold(cfg.min_score);

        if let Some(filter) = qdrant_filter {
            search_builder = search_builder.filter(filter);
        }

        let search_results = self
            .qdrant
            .search_points(search_builder)
            .await
            .map_err(|e| SearchError::Qdrant(e.to_string()))?;

        let candidates: Vec<RetrievedChunk> = search_results
            .result
            .into_iter()
            .map(|point| {
                let p = &point.payload;
                RetrievedChunk {
                    content: extract_str(p, "content"),
                    score: point.score,
                    rerank_score: 0.0,
                    document_id: extract_str(p, "document_id"),
                    section_title: extract_opt_str(p, "section_title"),
                    chunk_type: extract_str(p, "chunk_type"),
                    chunk_index: extract_u32(p, "chunk_index"),
                    context_before: None,
                    context_after: None,
                }
            })
            .collect();

        let total_candidates = candidates.len();

        tracing::debug!(candidates = total_candidates, "Vector search complete");

        if candidates.is_empty() {
            return Ok(RagResult {
                chunks: vec![],
                total_candidates: 0,
                search_time_ms: start.elapsed().as_millis() as u64,
            });
        }

        // ── Estágio 2: Expansão de contexto ─────────────────────────────────────
        let candidates = if cfg.expand_context {
            self.expander.expand(candidates, &collection).await?
        } else {
            candidates
        };

        // ── Estágio 3: Re-ranking ────────────────────────────────────────────────
        let mut candidates = if cfg.rerank {
            let doc_texts: Vec<&str> = candidates.iter().map(|c| c.content.as_str()).collect();
            let scores = self.reranker.rerank(query, &doc_texts).await?;

            let mut reranked: Vec<RetrievedChunk> = candidates
                .into_iter()
                .zip(scores.into_iter())
                .map(|(mut chunk, score)| {
                    chunk.rerank_score = score;
                    chunk
                })
                .collect();

            // Ordena por rerank_score descrescente
            reranked.sort_by(|a, b| {
                b.rerank_score
                    .partial_cmp(&a.rerank_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            reranked
        } else {
            // Sem rerank: usa score de cosseno e copia para rerank_score
            let mut sorted = candidates;
            sorted.sort_by(|a, b| {
                b.score
                    .partial_cmp(&a.score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            sorted.iter_mut().for_each(|c| c.rerank_score = c.score);
            sorted
        };

        // Limita ao top_k antes da dedup
        candidates.truncate(cfg.top_k * 2); // Margem para dedup

        // ── Estágio 4: Deduplicação ──────────────────────────────────────────────
        let mut deduplicated = deduplicate(candidates);
        deduplicated.truncate(cfg.top_k);

        let elapsed = start.elapsed().as_millis() as u64;
        tracing::info!(
            chunks_returned = deduplicated.len(),
            elapsed_ms = elapsed,
            "RAG search complete"
        );

        Ok(RagResult {
            chunks: deduplicated,
            total_candidates,
            search_time_ms: elapsed,
        })
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────────

    /// Embeda a query com prefixo especial para busca (Nomic V2)
    async fn embed_query(&self, query: &str) -> Result<Vec<f32>, SearchError> {
        let prefixed = format!("search_query: {}", query);
        let response: EmbedResponse = self
            .http
            .post(format!("{}/embed", self.embedding_url))
            .json(&EmbedRequest {
                texts: vec![prefixed],
            })
            .send()
            .await
            .map_err(SearchError::Http)?
            .json()
            .await
            .map_err(SearchError::Http)?;

        response
            .embeddings
            .into_iter()
            .next()
            .ok_or_else(|| SearchError::EmbeddingService("Empty embedding response".into()))
    }

    /// Constrói filtros do Qdrant a partir dos SearchFilters
    fn build_filter(filters: &Option<SearchFilters>) -> Option<Filter> {
        let filters = filters.as_ref()?;
        let mut conditions: Vec<Condition> = Vec::new();

        if let Some(doc_id) = &filters.document_id {
            conditions.push(Condition::matches("document_id", doc_id.clone()));
        }
        if let Some(chunk_type) = &filters.chunk_type {
            conditions.push(Condition::matches("chunk_type", chunk_type.clone()));
        }

        if conditions.is_empty() {
            None
        } else {
            Some(Filter::must(conditions))
        }
    }
}

// ─── Helpers para extrair valores do payload do Qdrant ───────────────────────────────

use qdrant_client::qdrant::value::Kind;
use std::collections::HashMap;

pub type QdrantPayload = HashMap<String, qdrant_client::qdrant::Value>;

fn extract_str(payload: &QdrantPayload, key: &str) -> String {
    payload
        .get(key)
        .and_then(|v| match v.kind.as_ref()? {
            Kind::StringValue(s) => Some(s.clone()),
            _ => None,
        })
        .unwrap_or_default()
}

fn extract_opt_str(payload: &QdrantPayload, key: &str) -> Option<String> {
    payload.get(key).and_then(|v| match v.kind.as_ref()? {
        Kind::StringValue(s) if !s.is_empty() && s != "null" => Some(s.clone()),
        _ => None,
    })
}

fn extract_u32(payload: &QdrantPayload, key: &str) -> u32 {
    payload
        .get(key)
        .and_then(|v| match v.kind.as_ref()? {
            Kind::IntegerValue(i) => Some(*i as u32),
            _ => None,
        })
        .unwrap_or(0)
}
