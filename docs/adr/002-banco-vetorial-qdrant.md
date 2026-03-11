# ADR-002 — Banco Vetorial: Qdrant

**Status:** Aceito  
**Data:** 2026-03

## Contexto

O pipeline RAG precisa armazenar e buscar milhões de vetores de embeddings (768 dimensões) com filtros por `workspace_id` e `document_id`, com latência < 100ms por busca.

## Decisão

Usar **Qdrant** como banco vetorial principal.

Alternativas avaliadas:

| Opção | Descartado por |
|--------|---------------|
| pgvector (PostgreSQL) | Performance insuficiente acima de 1M vetores |
| Weaviate | Complexidade de operação e consumo de RAM |
| Pinecone | Cloud-only, incompatível com requisito on-premise |
| Milvus | Overhead operacional alto para o porte do projeto |

Qdrant foi escolhido por:
- HNSW nativo com filtros payload sem degradação de performance
- API REST e gRPC simples
- Escala horizontal via shards quando necessário
- Suporte nativo a `named vectors` (futura expansão multi-modal)

## Consequências

**Positivas:**
- Busca vetorial com filtros de metadados sem custo extra de latência
- Deploy simples via Docker com volume persistente
- Isolamento por `workspace_id` via payload filter (sem coleções separadas)

**Negativas / Trade-offs:**
- Não é ACID — consistência eventual entre chunks indexados e PostgreSQL
- Backups requerem snapshot manual do volume Qdrant
