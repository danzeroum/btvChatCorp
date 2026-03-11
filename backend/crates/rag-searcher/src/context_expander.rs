use qdrant_client::{
    Qdrant,
    qdrant::{Filter, Condition, SearchPointsBuilder},
};
use serde_json::Value;

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
    async fn get_neighbor_content(
        &self,
        collection: &str,
        document_id: &str,
        chunk_index: u32,
    ) -> Result<Option<String>, SearchError> {
        // Busca com um vetor zero — só queremos o payload via filtro
        let dummy_vector = vec![0.0f32; 768];

        let filter = Filter::must(vec![
            Condition::matches("document_id", document_id.to_string()),
            Condition::matches("chunk_index", chunk_index as i64),
        ]);

        let results = self
            .qdrant
            .search_points(
                SearchPointsBuilder::new(collection, dummy_vector, 1)
                    .filter(filter)
                    .with_payload(true),
            )
            .await
            .map_err(|e| SearchError::Qdrant(e.to_string()))?;

        Ok(results
            .result
            .into_iter()
            .next()
            .and_then(|p| {
                p.payload
                    .get("content")
                    .and_then(|v| {
                        // Qdrant retorna Value como string
                        match v.kind.as_ref()? {
                            qdrant_client::qdrant::value::Kind::StringValue(s) => Some(s.clone()),
                            _ => None,
                        }
                    })
            }))
    }
}
