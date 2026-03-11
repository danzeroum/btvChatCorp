use qdrant_client::{
    Qdrant,
    qdrant::{
        CreateCollectionBuilder, Distance, FieldType, PointStruct,
        UpsertPointsBuilder, VectorParamsBuilder,
    },
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{errors::IndexError, Chunk};

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexResult {
    pub chunks_indexed: usize,
    pub collection: String,
    pub workspace_id: String,
}

pub struct DocumentIndexer {
    pub qdrant: Qdrant,
}

impl DocumentIndexer {
    pub fn new(qdrant_url: &str) -> Result<Self, IndexError> {
        let qdrant = Qdrant::from_url(qdrant_url)
            .build()
            .map_err(|e| IndexError::Qdrant(e.to_string()))?;
        Ok(Self { qdrant })
    }

    /// Indexa todos os chunks de um documento no Qdrant
    pub async fn index_document(
        &self,
        chunks: &[Chunk],
        workspace_id: Uuid,
    ) -> Result<IndexResult, IndexError> {
        let collection = format!("workspace_{}", workspace_id);

        // 1. Garante que a collection existe com as configurações corretas
        self.ensure_collection(&collection).await?;

        // 2. Monta PointStructs para o Qdrant
        let points: Vec<PointStruct> = chunks
            .iter()
            .filter_map(|chunk| {
                let embedding = chunk.embedding.clone()?;

                // Payload com todos os metadados necessários para filtragem e recuperação
                let payload = serde_json::json!({
                    "document_id": chunk.document_id.to_string(),
                    "workspace_id": chunk.workspace_id.to_string(),
                    "content": chunk.content,
                    "chunk_index": chunk.chunk_index,
                    "total_chunks": chunk.total_chunks,
                    "section_title": chunk.section_title,
                    "chunk_type": format!("{:?}", chunk.chunk_type),
                    "token_count": chunk.token_count,
                    "previous_chunk_id": chunk.previous_chunk_id.map(|id| id.to_string()),
                    "next_chunk_id": chunk.next_chunk_id.map(|id| id.to_string()),
                });

                Some(PointStruct::new(
                    chunk.id.to_string(),
                    embedding,
                    payload
                        .as_object()
                        .cloned()
                        .unwrap_or_default()
                        .into_iter()
                        .map(|(k, v)| (k, qdrant_client::qdrant::Value::from(v.to_string())))
                        .collect::<std::collections::HashMap<_, _>>(),
                ))
            })
            .collect();

        // 3. Upsert em batches de 100
        for batch in points.chunks(100) {
            self.qdrant
                .upsert_points(
                    UpsertPointsBuilder::new(&collection, batch.to_vec()).wait(true),
                )
                .await
                .map_err(|e| IndexError::Qdrant(e.to_string()))?;
        }

        Ok(IndexResult {
            chunks_indexed: chunks.len(),
            collection,
            workspace_id: workspace_id.to_string(),
        })
    }

    /// Garante que a collection existe com config correta (768 dim, Cosine)
    async fn ensure_collection(&self, name: &str) -> Result<(), IndexError> {
        let exists = self
            .qdrant
            .collection_exists(name)
            .await
            .map_err(|e| IndexError::Qdrant(e.to_string()))?;

        if !exists {
            self.qdrant
                .create_collection(
                    CreateCollectionBuilder::new(name)
                        .vectors_config(
                            VectorParamsBuilder::new(
                                768,        // Nomic Embed V2: 768 dimensões
                                Distance::Cosine,
                            )
                        )
                )
                .await
                .map_err(|e| IndexError::Qdrant(e.to_string()))?;

            // Índices para filtros frequentes
            for field in ["document_id", "chunk_type", "workspace_id"] {
                self.qdrant
                    .create_field_index(
                        name, field, FieldType::Keyword, None, None,
                    )
                    .await
                    .map_err(|e| IndexError::Qdrant(e.to_string()))?;
            }

            tracing::info!(collection = name, "Qdrant collection created");
        }

        Ok(())
    }

    /// Remove todos os chunks de um documento da collection
    pub async fn delete_document_chunks(
        &self,
        workspace_id: Uuid,
        document_id: Uuid,
    ) -> Result<(), IndexError> {
        let collection = format!("workspace_{}", workspace_id);

        self.qdrant
            .delete_points(
                &collection,
                None,
                &qdrant_client::qdrant::Filter::must(vec![
                    qdrant_client::qdrant::Condition::matches(
                        "document_id",
                        document_id.to_string(),
                    ),
                ]),
                None,
            )
            .await
            .map_err(|e| IndexError::Qdrant(e.to_string()))?;

        Ok(())
    }
}
