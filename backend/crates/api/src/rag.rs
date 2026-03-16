//! Cliente RAG: embeda a query do usuário e busca chunks relevantes no Qdrant.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

// ── Embedding ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct EmbedRequest {
    texts: Vec<String>,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

async fn embed_query(embedding_url: &str, query: &str) -> Result<Vec<f32>> {
    let client = reqwest::Client::new();
    // Prefixo correto para queries no Nomic V2
    let prefixed = format!("search_query: {}", query);
    let resp = client
        .post(format!("{}/embed", embedding_url))
        .json(&EmbedRequest { texts: vec![prefixed] })
        .send()
        .await?
        .error_for_status()?
        .json::<EmbedResponse>()
        .await?;
    resp.embeddings
        .into_iter()
        .next()
        .ok_or_else(|| anyhow::anyhow!("Serviço de embedding retornou lista vazia"))
}

// ── Qdrant search ────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct QdrantSearchRequest {
    vector: Vec<f32>,
    limit:  usize,
    #[serde(rename = "with_payload")]
    with_payload: bool,
    /// Filtro por workspace_id (garante isolamento multi-tenant)
    filter: serde_json::Value,
    /// Score mínimo de relevância (0.0 – 1.0)
    score_threshold: f32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RagChunk {
    pub content:     String,
    pub filename:    String,
    pub section:     String,
    pub chunk_index: i64,
    pub score:       f32,
}

/// Busca os `top_k` chunks mais relevantes para a query dentro da collection
/// do workspace. Retorna lista vazia se a collection ainda não existe
/// (nenhum documento processado) em vez de retornar erro.
pub async fn search_rag(
    qdrant_url:    &str,
    embedding_url: &str,
    workspace_id:  &str,
    query:         &str,
    top_k:         usize,
    min_score:     f32,
) -> Result<Vec<RagChunk>> {
    // 1. Embeda a query
    let vector = match embed_query(embedding_url, query).await {
        Ok(v) => v,
        Err(e) => {
            warn!("Embedding indisponível, seguindo sem RAG: {}", e);
            return Ok(vec![]);
        }
    };

    // 2. Busca no Qdrant
    let collection = format!("workspace_{}",
        workspace_id.replace('-', ""));

    let body = QdrantSearchRequest {
        vector,
        limit: top_k,
        with_payload: true,
        score_threshold: min_score,
        filter: serde_json::json!({
            "must": [{
                "key":   "workspace_id",
                "match": { "value": workspace_id }
            }]
        }),
    };

    let url  = format!("{}/collections/{}/points/search", qdrant_url, collection);
    let resp = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .send()
        .await;

    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            warn!("Qdrant indisponível, seguindo sem RAG: {}", e);
            return Ok(vec![]);
        }
    };

    // Collection ainda não existe → tudo bem, sem contexto
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        debug!("Collection '{}' não existe ainda (nenhum doc processado)", collection);
        return Ok(vec![]);
    }

    let json: serde_json::Value = resp.error_for_status()?.json().await?;
    let results = json["result"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let chunks = results
        .into_iter()
        .filter_map(|r| {
            let score   = r["score"].as_f64()? as f32;
            let payload = r.get("payload")?;
            Some(RagChunk {
                content:     payload["content"].as_str()?.to_string(),
                filename:    payload["filename"].as_str().unwrap_or("").to_string(),
                section:     payload["section"].as_str().unwrap_or("").to_string(),
                chunk_index: payload["chunk_index"].as_i64().unwrap_or(0),
                score,
            })
        })
        .collect();

    Ok(chunks)
}

// ── Formatação do contexto para o prompt ─────────────────────────────────────

/// Monta o bloco de contexto RAG que vai no system prompt.
/// Retorna `None` se não houver chunks relevantes.
pub fn build_rag_context(chunks: &[RagChunk]) -> Option<String> {
    if chunks.is_empty() {
        return None;
    }
    let mut ctx = String::from(
        "## Contexto recuperado da base de conhecimento\n\
         Use as informações abaixo para responder. \
         Cite a fonte entre parênteses ao final de cada afirmação.\n\n"
    );
    for (i, chunk) in chunks.iter().enumerate() {
        ctx.push_str(&format!(
            "### Fonte {} — {} | {}\n{}\n\n",
            i + 1,
            chunk.filename,
            chunk.section,
            chunk.content,
        ));
    }
    Some(ctx)
}

/// Serializa as fontes usadas para salvar na coluna `sources` da mensagem.
pub fn build_sources_json(chunks: &[RagChunk]) -> Option<serde_json::Value> {
    if chunks.is_empty() {
        return None;
    }
    Some(serde_json::json!(
        chunks.iter().map(|c| serde_json::json!({
            "filename":    c.filename,
            "section":     c.section,
            "chunk_index": c.chunk_index,
            "score":       c.score,
        })).collect::<Vec<_>>()
    ))
}
