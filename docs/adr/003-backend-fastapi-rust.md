# ADR-003 — Backend: FastAPI + Rust RAG Searcher

**Status:** Aceito  
**Data:** 2026-03

## Contexto

O backend precisa orquestrar autenticação, upload de documentos, chamadas ao LLM com streaming, e executar buscas vetoriais de alta performance. Uma única tecnologia não atende todos os requisitos com a mesma eficiência.

## Decisão

Usar arquitetura **políglota**:
- **FastAPI (Python)** para a API principal: auth, upload, orquestração, admin, webhooks
- **Rust (Axum)** exclusivamente para o `rag-searcher`: busca vetorial + reranking + montação de contexto

## Justificativa da divisão

| Responsabilidade | Tecnologia | Motivo |
|-----------------|-----------|--------|
| Auth, CRUD, admin | FastAPI | Velocidade de desenvolvimento, ecossistema ML |
| Busca vetorial hot-path | Rust (Axum) | Zero GC pause, concência assíncrona, latência p99 < 50ms |
| Document processing | Python | Bibliotecas de NLP (spaCy, Unstructured, Presidio) |
| Fine-tuning | Python | Unsloth, HuggingFace, PyTorch |

## Consequências

**Positivas:**
- Latência de busca RAG consistentemente baixa mesmo sob carga
- Python no caminho lento (upload, admin) sem penalizar o caminho crítico

**Negativas / Trade-offs:**
- Dois runtimes aumentam a complexidade de build e deploy
- Desenvolvedores precisam conhecer Rust para contribuir no `rag-searcher`
