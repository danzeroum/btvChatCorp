# ADR-005 — Pipeline RAG: chunk → embed → search → rerank → generate

**Status:** Aceito  
**Data:** 2026-03

## Contexto

O sistema precisa responder perguntas baseadas em documentos corporativos (PDF, DOCX, XLSX, etc.) com alta precisão. A estratégia de retrieval impacta diretamente a qualidade das respostas.

## Decisão

Adotar pipeline RAG em 5 etapas:

```
Documento → Chunking (512 tokens, overlap 64) → Embedding (Nomic V2)
         → Qdrant HNSW (top-20) → Cross-encoder Rerank (top-5)
         → LLM (Llama 3.3 70B + LoRA workspace)
```

**Detalhes de cada etapa:**

| Etapa | Implementação | Decisão |
|-------|--------------|--------|
| Chunking | 512 tokens, overlap 64 | Chunks menores = maior precisão semântica |
| Embedding | Nomic Embed V2 768-dim | Melhor custo-benefício open-source para PT-BR |
| Busca | Qdrant HNSW top-20 | Recall alto antes do reranking |
| Reranking | ms-marco-MiniLM-L-6-v2 | Reordena por relevância semântica real |
| Geração | Llama 3.3 70B + LoRA | Modelo fine-tuned por workspace |

## Consequências

**Positivas:**
- Reranking elimina falsos positivos do HNSW, aumentando precisão
- Pipeline assíncrono: indexação não bloqueia queries
- Cada etapa é substituível independentemente

**Negativas / Trade-offs:**
- Reranking adiciona ~30-50ms de latência por query
- Chunks de 512 tokens podem fragmentar tabelas e listas — mitigado com chunking por estrutura do documento
