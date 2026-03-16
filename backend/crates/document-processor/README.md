# Document Processor — RAG Worker

Crate Rust responsável por processar documentos `pending` e indexá-los no Qdrant para o pipeline RAG.

## Pipeline (5 etapas)

```
documento pending
    │
    ▼
1. EXTRAÇÃO   — extractor.rs
   PDF nativo  → pdf-extract
   DOCX        → docx-rs
   Texto/CSV   → std fs
   HTML        → strip tags regex
    │
    ▼
2. SELEÇÃO DA ESTRATÉGIA — strategy.rs
   Jurídico?   → ChunkingStrategy::Legal
   Médico?     → ChunkingStrategy::Medical
   Tabular?    → ChunkingStrategy::Table
   Estruturado?→ ChunkingStrategy::Semantic
   Corrido?    → ChunkingStrategy::Sentence
   Fallback    → ChunkingStrategy::FixedSize
    │
    ▼
3. CHUNKING   — chunker.rs
   Divide respeitando seções, cláusulas ou parágrafos
   Encadeia prev_chunk_id / next_chunk_id
   Conta tokens (aprox 1 token = 4 chars)
    │
    ▼
4. EMBEDDING  — embedder.rs
   Chama services/embedding (FastAPI + Nomic V2)
   Prefixo: "search_document: {section}\n{content}"
   Batches de 32 chunks por vez
   Resultado: Vec<f32> de 768 dimensões
    │
    ▼
5. INDEXAÇÃO  — indexer.rs
   Salva chunks no PostgreSQL (document_chunks)
   Upsert no Qdrant collection workspace_{id}
   Marca documento como 'completed'
```

## Variáveis de Ambiente

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `QDRANT_URL` | ❌ | `http://localhost:6333` | Qdrant HTTP URL |
| `EMBEDDING_URL` | ❌ | `http://localhost:8001` | Serviço Python de embedding |
| `STORAGE_PATH` | ❌ | `/data/uploads` | Caminho local dos arquivos |
| `POLL_INTERVAL_SECS` | ❌ | `10` | Intervalo de poll em segundos |
| `WORKER_CONCURRENCY` | ❌ | `4` | Documentos em paralelo |
| `MAX_RETRIES` | ❌ | `3` | Máx. tentativas por documento |

## Como rodar

```bash
# Stack completo (Qdrant + Embedding + Worker)
cd backend
docker compose -f docker-compose.rag.yml up

# Só o worker (com Qdrant/Embedding já no ar)
DATABASE_URL=postgres://... \
QDRANT_URL=http://localhost:6333 \
EMBEDDING_URL=http://localhost:8001 \
cargo run --bin rag-worker
```

## Estratégias de Chunking

| Estratégia | Quando usa | Max tokens/chunk |
|---|---|---|
| `Semantic` | Documentos com seções (padrão) | 512 |
| `Legal` | Setor jurídico, cláusulas detectadas | 800 |
| `Medical` | Setor saúde, termos clínicos | 600 |
| `Sentence` | Texto corrido sem estrutura | 400–600 |
| `FixedSize` | Fallback | 512 + 50 overlap |
| `Table` | Documentos com tabelas dominantes | por bloco |

## Fluxo de Status do Documento

```
pending → processing → completed
              ↓
           failed (retry_count < MAX_RETRIES → volta para pending)
```

## Integração com o Chat

O handler de chat (`crates/api/src/routes/chats.rs`) busca no Qdrant
usando a collection `workspace_{workspace_id}` para construir o contexto RAG
antes de chamar o LLM.
