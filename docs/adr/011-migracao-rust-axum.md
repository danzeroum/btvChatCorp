# ADR-011 — Migração do Backend: FastAPI → Rust/Axum

**Status:** ACEITO  
**Data:** 2026-05-19  
**Supersede:** ADR-003

## Contexto

Após a fase de prototipagem com FastAPI, identificamos gargalos de performance
em três áreas críticas:

1. **Streaming de respostas LLM** — o FastAPI + uvicorn não sustentava >50 conexões
   simultâneas com streaming SSE sem degradação significativa de latência.
2. **Processamento de documentos (RAG Worker)** — parsing e chunking de PDFs grandes
   (>100 páginas) bloqueava o event loop do Python.
3. **Segurança de tipos** — bugs em produção causados por dicts não tipados no código
   de autenticação e gerenciamento de API keys.

## Decisão

Migrar o backend para **Rust** com o framework **Axum**, mantendo a mesma API REST
(endpoints, contratos JSON, autenticação JWT) para não quebrar o frontend Angular.

### Stack escolhida

| Componente | Tecnologia | Justificativa |
|---|---|---|
| Framework HTTP | Axum 0.7 | Ergonomia, integração com Tokio, performance |
| Runtime async | Tokio | Padrão de mercado para Rust async |
| ORM / SQL | SQLx (query macros) | Verificação de queries em compile-time |
| Autenticação | jsonwebtoken + argon2 | Crates auditadas, sem dependências inseguras |
| Rate limiting | governor | Algoritmo token-bucket, suporte a Redis |
| Serialização | serde + serde_json | Zero-copy, amplamente testado |

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Manter FastAPI + otimizar | Limite arquitetural: GIL impede paralelismo real |
| Go + Gin | Menor expressividade de tipos; ecossistema menor para ML adjacente |
| Node.js + Fastify | Performance inferior ao Rust; tipagem opcional |
| gRPC / tRPC | Frontend Angular já usa REST; migração de contrato custosa |

## Consequências

### Positivas
- ✅ Throughput 8–12× maior em benchmarks de streaming SSE
- ✅ Processamento de documentos em threads separadas sem bloquear HTTP
- ✅ Erros de tipo detectados em compile-time (zero `TypeError` em runtime)
- ✅ Binário único, sem dependência de runtime Python em produção
- ✅ Uso de memória 60–80% menor que FastAPI equivalente

### Negativas / Trade-offs
- ❌ Curva de aprendizado Rust para novos contribuidores
- ❌ Compile-time mais longo (mitigado com cache Cargo no CI)
- ❌ Ecossistema ML em Rust menos maduro (training permanece em Python)

## Notas de migração

- O crate `document-processor` encapsula o RAG Worker (extractor, chunker, embedder, indexer)
- O crate `api` expõe todos os endpoints REST; `AppState` centraliza serviços
- O backend Python legado foi removido em Sprint 1 (ver PR #57)
- ADR-003 marcado como SUPERSEDED

## Referências

- [Axum documentation](https://docs.rs/axum)
- [Tokio runtime](https://tokio.rs)
- [SQLx](https://github.com/launchbadge/sqlx)
- PR #57 — S1-A Compilabilidade
- PR #61 — S2-B Backend Core (AdminService, UserService, AuditService)
