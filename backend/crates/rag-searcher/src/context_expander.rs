use qdrant_client::{
    qdrant::{Condition, Filter, ScrollPointsBuilder},
    Qdrant,
};

use crate::{errors::SearchError, searcher::RetrievedChunk};

pub struct ContextExpander {
    pub qdrant: Qdrant,
}

impl ContextExpander {
    pub fn new(qdrant: Qdrant) -> Self {
        Self { qdrant }
    }

    /// Expande cada chunk com seus vizinhos (chunk anterior e posterior).
    /// Usa os campos `previous_chunk_id` / `next_chunk_id` salvos na ingestão.
    /// Isso dá ao LLM mais contexto sem indexar chunks duplicados.
    pub async fn expand(
        &self,
        mut chunks: Vec<RetrievedChunk>,
        collection: &str,
    ) -> Result<Vec<RetrievedChunk>, SearchError> {
        for chunk in chunks.iter_mut() {
            // Chunk anterior
            if chunk.chunk_index > 0 {
                if let Ok(Some(content)) = self
                    .get_neighbor_content(collection, &chunk.document_id, chunk.chunk_index - 1)
                    .await
                {
                    chunk.context_before = Some(content);
                }
            }

            // Chunk posterior
            if let Ok(Some(content)) = self
                .get_neighbor_content(collection, &chunk.document_id, chunk.chunk_index + 1)
                .await
            {
                chunk.context_after = Some(content);
            }
        }
        Ok(chunks)
    }

    /// Busca o conteúdo de um chunk vizinho por document_id + chunk_index.
    /// Usa scroll (sem vetor) para buscar por filtro exato, evitando resultados
    /// baseados em similaridade com vetor zero que seriam semanticamente irrelevantes.
    async fn get_neighbor_content(
        &self,
        collection: &str,
        document_id: &str,
        chunk_index: u32,
    ) -> Result<Option<String>, SearchError> {
        let filter = Filter::must(vec![
            Condition::matches("document_id", document_id.to_string()),
            Condition::matches("chunk_index", chunk_index as i64),
        ]);

        let results = self
            .qdrant
            .scroll(
                ScrollPointsBuilder::new(collection)
                    .filter(filter)
                    .with_payload(true)
                    .limit(1u32),
            )
            .await
            .map_err(|e| SearchError::Qdrant(e.to_string()))?;

        Ok(results.result.into_iter().next().and_then(|p| {
            p.payload.get("content").and_then(|v| {
                match v.kind.as_ref()? {
                    qdrant_client::qdrant::value::Kind::StringValue(s) => Some(s.clone()),
                    _ => None,
                }
            })
        }))
    }
}
