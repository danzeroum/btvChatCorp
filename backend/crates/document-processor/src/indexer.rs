use anyhow::{Result, Context};
use qdrant_client::{
    Qdrant,
    qdrant::{
        CreateCollectionBuilder, Distance, PointStruct,
        UpsertPointsBuilder, VectorParamsBuilder, vectors::VectorsOptions,
    },
};
use serde_json::json;
use tracing::{info, warn};
use uuid::Uuid;

use crate::models::Chunk;

// ---------------------------------------------------------------------------
// Indexer: persiste chunks (com embeddings) no Qdrant
// ---------------------------------------------------------------------------

pub struct DocumentIndexer {
    qdrant: Qdrant,
}

impl DocumentIndexer {
    pub fn new(qdrant_url: impl Into<String>) -> Result<Self> {
        let qdrant = Qdrant::from_url(&qdrant_url.into()).build()?;
        Ok(Self { qdrant })
    }

    /// Indexa todos os chunks de um documento.
    /// Pré-requisito: todos os chunks devem ter `embedding` preenchido.
    pub async fn index_document(
        &self,
        chunks: &[Chunk],
        workspace_id: Uuid,
    ) -> Result<IndexResult> {
        let collection = format!("workspace_{workspace_id}");
        self.ensure_collection(&collection).await?;

        // Monta pontos em batches de 100
        let mut indexed = 0usize;
        for batch in chunks.chunks(100) {
            let points: Vec<PointStruct> = batch
                .iter()
                .filter_map(|chunk| {
                    let embedding = chunk.embedding.clone()?;
                    let payload = json!({
                        "document_id":    chunk.document_id.to_string(),
                        "workspace_id":   chunk.workspace_id.to_string(),
                        "content":        chunk.content,
                        "chunk_index":    chunk.chunk_index,
                        "total_chunks":   chunk.total_chunks,
                        "section_title":  chunk.section_title,
                        "chunk_type":     chunk.chunk_type.to_string(),
                        "token_count":    chunk.token_count,
                        "previous_chunk_id": chunk.previous_chunk_id.map(|u| u.to_string()),
                        "next_chunk_id":     chunk.next_chunk_id.map(|u| u.to_string()),
                    });
                    Some(PointStruct::new(
                        chunk.id.to_string(),
                        embedding,
                        payload
                            .as_object()
                            .unwrap()
                            .iter()
                            .map(|(k, v)| (k.clone(), qdrant_payload_value(v)))
                            .collect::<std::collections::HashMap<_, _>>(),
                    ))
                })
                .collect();

            self.qdrant
                .upsert_points(
                    UpsertPointsBuilder::new(&collection, points).wait(true),
                )
                .await
                .context("qdrant upsert")?;

            indexed += batch.len();
        }

        info!("Indexado {indexed} chunks na collection {collection}");
        Ok(IndexResult { chunks_indexed: indexed, collection })
    }

    // -----------------------------------------------------------------------
    // Garante que a collection existe com a config correta
    // -----------------------------------------------------------------------
    async fn ensure_collection(&self, name: &str) -> Result<()> {
        if self.qdrant.collection_exists(name).await? {
            return Ok(());
        }
        info!("Criando collection Qdrant: {name}");
        self.qdrant
            .create_collection(
                CreateCollectionBuilder::new(name)
                    .vectors_config(VectorParamsBuilder::new(
                        768,              // Nomic Embed V2: 768 dimensões
                        Distance::Cosine,
                    )),
            )
            .await
            .context("create collection")?;

        // Índices para filtros frequentes
        for field in ["document_id", "workspace_id", "chunk_type"] {
            self.qdrant
                .create_field_index(
                    name,
                    field,
                    qdrant_client::qdrant::FieldType::Keyword,
                    None,
                    None,
                )
                .await
                .ok(); // não fatal se já existir
        }
        Ok(())
    }
}

#[derive(Debug)]
pub struct IndexResult {
    pub chunks_indexed: usize,
    pub collection: String,
}

// ---------------------------------------------------------------------------
// Helper: converte serde_json::Value -> qdrant Payload Value
// ---------------------------------------------------------------------------
fn qdrant_payload_value(v: &serde_json::Value) -> qdrant_client::qdrant::Value {
    use qdrant_client::qdrant::{value::Kind, Value};
    let kind = match v {
        serde_json::Value::Null      => Kind::NullValue(0),
        serde_json::Value::Bool(b)   => Kind::BoolValue(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() { Kind::IntegerValue(i) }
            else { Kind::DoubleValue(n.as_f64().unwrap_or_default()) }
        }
        serde_json::Value::String(s) => Kind::StringValue(s.clone()),
        serde_json::Value::Array(a)  => {
            Kind::ListValue(qdrant_client::qdrant::ListValue {
                values: a.iter().map(qdrant_payload_value).collect(),
            })
        }
        serde_json::Value::Object(_) => Kind::StringValue(v.to_string()),
    };
    Value { kind: Some(kind) }
}
