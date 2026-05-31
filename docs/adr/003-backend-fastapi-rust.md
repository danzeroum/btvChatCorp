# ADR-003 — Backend: Rust/Axum como Runtime Principal

**Status:** Atualizado (2026-05)
**Data original:** 2026-03

## Contexto

O backend precisa orquestrar autenticação, upload de documentos, chamadas ao LLM com streaming,
e executar buscas vetoriais de alta performance. A decisão original dividia responsabilidades
entre FastAPI (Python) e Rust. A execução real migrou integralmente para Rust.

## Decisão Atual

O **crate `api` (Rust/Axum 0.7)** é o único runtime principal da plataforma.
O `backend/app/` (FastAPI Python) foi removido em mai/2026 — era código legado não utilizado.

### Arquitetura de crates Rust

| Crate | Responsabilidade |
|-------|-----------------|
| `api` | API principal: auth, chat, documents, admin, onboarding |
| `api-public` | API pública OpenAI-compat com API keys |
| `document-processor` | Worker de ingestão e indexação assíncrona |
| `rag-searcher` | Busca vetorial (Qdrant) + context expansion |
| `ai-orchestrator` | Orquestração LLM + streaming |
| `branding` | White-label CSS generator |
| `webhooks` | Dispatcher HMAC-SHA256 |
| `onboarding` | Wizard de setup do workspace |

### Microserviços Python (mantidos)

| Serviço | Responsabilidade | Motivo |
|---------|-----------------|--------|
| `services/embedding` | Nomic Embed V2 MoE | Depende de PyTorch/sentence-transformers |
| `services/reranker` | CrossEncoder ms-marco | Depende de sentence-transformers |

## Justificativa da migração completa para Rust

- FastAPI foi avaliado mas o `crate api` já cobria todos os casos de uso com tipagem forte, sem GC, e integração nativa com sqlx/Tower.
- Manter dois runtimes (Python + Rust) para a API principal aumentava a superfície de ataque e duplicava a lógica de autenticação/JWT.
- Os microserviços de embedding e reranking permanecem em Python por dependência obrigatória de PyTorch.

## Consequências

**Positivas:**
- Única superfície de ataque na API principal
- Latência consistente em todas as rotas (sem GIL, sem GC)
- Tipagem estática de ponta a ponta no caminho crítico

**Negativas / Trade-offs:**
- Todos os contribuidores da API principal precisam conhecer Rust
- Build mais lento que Python (compensado pelo cache de Docker layers)
