//! Cliente RAG: embeda a query do usuário e busca chunks relevantes no Qdrant.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

// -- Embedding

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
    let prefixed = format!("search_query: {}", query);
    // O token e obrigatorio e validado no startup (main.rs). Aqui retornamos Err
    // em vez de panicar: search_rag trata o Err degradando o RAG graciosamente,
    // evitando derrubar a task do handler. Nunca enviamos token vazio (a falha
    // BH-04 era justamente unwrap_or_default() mandando "" como credencial).
    let internal_token = std::env::var("INTERNAL_SERVICE_TOKEN").map_err(|_| {
        anyhow::anyhow!("INTERNAL_SERVICE_TOKEN ausente — RAG desabilitado nesta requisicao")
    })?;
    let resp = client
        .post(format!("{}/embed", embedding_url))
        .header("X-Internal-Token", internal_token)
        .json(&EmbedRequest {
            texts: vec![prefixed],
        })
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

// -- Reranking (cross-encoder — 2o estagio de qualidade do RAG)

#[derive(Deserialize)]
struct RerankResponse {
    scores: Vec<f32>,
}

/// Reordena os chunks por relevancia usando o cross-encoder (servico `reranker`).
/// Degrada graciosamente para a ordem vetorial original se o reranker falhar,
/// o token interno faltar, ou o nº de scores nao bater com o nº de chunks.
async fn rerank(reranker_url: &str, query: &str, chunks: Vec<RagChunk>) -> Vec<RagChunk> {
    if chunks.len() <= 1 {
        return chunks;
    }
    match try_rerank(reranker_url, query, &chunks).await {
        Ok(scores) if scores.len() == chunks.len() => reorder_by_scores(scores, chunks),
        Ok(_) => {
            warn!("Reranker: nº de scores != nº de chunks, mantendo ordem vetorial");
            chunks
        }
        Err(e) => {
            warn!("Reranker indisponível, mantendo ordem vetorial: {}", e);
            chunks
        }
    }
}

async fn try_rerank(reranker_url: &str, query: &str, chunks: &[RagChunk]) -> Result<Vec<f32>> {
    let internal_token = std::env::var("INTERNAL_SERVICE_TOKEN")
        .map_err(|_| anyhow::anyhow!("INTERNAL_SERVICE_TOKEN ausente"))?;
    let documents: Vec<&str> = chunks.iter().map(|c| c.content.as_str()).collect();
    let rr = reqwest::Client::new()
        .post(format!("{}/rerank", reranker_url))
        .header("X-Internal-Token", internal_token)
        .json(&serde_json::json!({ "query": query, "documents": documents }))
        .send()
        .await?
        .error_for_status()?
        .json::<RerankResponse>()
        .await?;
    Ok(rr.scores)
}

/// Reordena os chunks por score do cross-encoder (desc). Se o nº de scores nao
/// bater com o nº de chunks, devolve a ordem original (no-op seguro).
fn reorder_by_scores(scores: Vec<f32>, chunks: Vec<RagChunk>) -> Vec<RagChunk> {
    if scores.len() != chunks.len() {
        return chunks;
    }
    let mut paired: Vec<(f32, RagChunk)> = scores.into_iter().zip(chunks).collect();
    paired.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    paired.into_iter().map(|(_, c)| c).collect()
}

// -- Qdrant search

#[derive(Serialize)]
struct QdrantSearchRequest {
    vector: Vec<f32>,
    limit: usize,
    #[serde(rename = "with_payload")]
    with_payload: bool,
    /// Filtro por workspace_id (garante isolamento multi-tenant)
    filter: serde_json::Value,
    /// Score mínimo de relevância (0.0 – 1.0)
    score_threshold: f32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RagChunk {
    pub content: String,
    pub filename: String,
    pub section: String,
    pub chunk_index: i64,
    pub score: f32,
}

/// Busca os `top_k` chunks mais relevantes para a query dentro da collection
/// do workspace. Retorna lista vazia se a collection ainda não existe
/// (nenhum documento processado) em vez de retornar erro.
pub async fn search_rag(
    qdrant_url: &str,
    embedding_url: &str,
    workspace_id: &str,
    query: &str,
    top_k: usize,
    min_score: f32,
) -> Result<Vec<RagChunk>> {
    // 1. Embeda a query
    let vector = match embed_query(embedding_url, query).await {
        Ok(v) => v,
        Err(e) => {
            warn!("Embedding indisponível, seguindo sem RAG: {}", e);
            return Ok(vec![]);
        }
    };

    // 2. Busca no Qdrant. Se o reranker estiver configurado, busca mais
    // candidatos no vetor e deixa o cross-encoder escolher os melhores top_k.
    let reranker_url = std::env::var("RERANKER_URL").ok().filter(|s| !s.is_empty());
    let candidate_k = if reranker_url.is_some() {
        (top_k * 4).clamp(top_k, 50)
    } else {
        top_k
    };
    let collection = format!("workspace_{}", workspace_id.replace('-', ""));

    let body = QdrantSearchRequest {
        vector,
        limit: candidate_k,
        with_payload: true,
        score_threshold: min_score,
        filter: serde_json::json!({
            "must": [{
                "key":   "workspace_id",
                "match": { "value": workspace_id }
            }]
        }),
    };

    let url = format!("{}/collections/{}/points/search", qdrant_url, collection);
    let resp = reqwest::Client::new().post(&url).json(&body).send().await;

    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            warn!("Qdrant indisponível, seguindo sem RAG: {}", e);
            return Ok(vec![]);
        }
    };

    // Collection ainda não existe → tudo bem, sem contexto
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        debug!(
            "Collection '{}' não existe ainda (nenhum doc processado)",
            collection
        );
        return Ok(vec![]);
    }

    let json: serde_json::Value = resp.error_for_status()?.json().await?;
    let results = json["result"].as_array().cloned().unwrap_or_default();

    let chunks: Vec<RagChunk> = results
        .into_iter()
        .filter_map(|r| {
            let score = r["score"].as_f64()? as f32;
            let payload = r.get("payload")?;
            Some(RagChunk {
                content: payload["content"].as_str()?.to_string(),
                filename: payload["filename"].as_str().unwrap_or("").to_string(),
                section: payload["section"].as_str().unwrap_or("").to_string(),
                chunk_index: payload["chunk_index"].as_i64().unwrap_or(0),
                score,
            })
        })
        .collect();

    // 3. Rerank (cross-encoder) se configurado; trunca para top_k.
    let chunks = match &reranker_url {
        Some(rurl) => rerank(rurl, query, chunks)
            .await
            .into_iter()
            .take(top_k)
            .collect(),
        None => chunks,
    };

    Ok(chunks)
}

// -- Formatação do contexto para o prompt

/// Monta o bloco de contexto RAG que vai no system prompt.
/// Retorna `None` se não houver chunks relevantes.
pub fn build_rag_context(chunks: &[RagChunk]) -> Option<String> {
    if chunks.is_empty() {
        return None;
    }
    let mut ctx = String::from(
        "## Contexto recuperado da base de conhecimento\n\
         Use as informações abaixo para responder. \
         Cite a fonte entre parênteses ao final de cada afirmação.\n\n",
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
    Some(serde_json::json!(chunks
        .iter()
        .map(|c| serde_json::json!({
            "filename":    c.filename,
            "section":     c.section,
            "chunk_index": c.chunk_index,
            "score":       c.score,
        }))
        .collect::<Vec<_>>()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chunk(content: &str) -> RagChunk {
        RagChunk {
            content: content.into(),
            filename: "f".into(),
            section: "s".into(),
            chunk_index: 0,
            score: 0.0,
        }
    }

    #[test]
    fn reorder_by_scores_sorts_desc() {
        let chunks = vec![chunk("a"), chunk("b"), chunk("c")];
        // scores a=0.1, b=0.9, c=0.5 -> ordem esperada b, c, a
        let out = reorder_by_scores(vec![0.1, 0.9, 0.5], chunks);
        let order: Vec<&str> = out.iter().map(|c| c.content.as_str()).collect();
        assert_eq!(order, vec!["b", "c", "a"]);
    }

    #[test]
    fn reorder_by_scores_mismatch_is_noop() {
        let chunks = vec![chunk("a"), chunk("b")];
        let out = reorder_by_scores(vec![0.9], chunks); // tamanho != chunks
        let order: Vec<&str> = out.iter().map(|c| c.content.as_str()).collect();
        assert_eq!(order, vec!["a", "b"]);
    }
}
