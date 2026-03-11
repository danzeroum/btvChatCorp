# Architecture Decision Records (ADR)

Este diretório documenta as principais decisões arquiteturais do **BTV Chat Corp**.

Cada ADR segue o formato simplificado:
- **Status**: Aceito | Deprecado | Substituído por
- **Contexto**: Por que a decisão precisou ser tomada
- **Decisão**: O que foi decidido
- **Consequências**: Trade-offs e impactos

## Índice

| # | Título | Status |
|---|--------|--------|
| [ADR-001](./001-llm-vllm-llama3.md) | LLM: vLLM + Llama 3.3 70B | Aceito |
| [ADR-002](./002-banco-vetorial-qdrant.md) | Banco Vetorial: Qdrant | Aceito |
| [ADR-003](./003-backend-fastapi-rust.md) | Backend: FastAPI + Rust RAG Searcher | Aceito |
| [ADR-004](./004-autenticacao-jwt-mfa.md) | Autenticação: JWT + MFA TOTP | Aceito |
| [ADR-005](./005-rag-pipeline.md) | Pipeline RAG: chunk, embed, rerank | Aceito |
| [ADR-006](./006-embedding-nomic-v2.md) | Embedding: Nomic Embed V2 MoE | Aceito |
| [ADR-007](./007-fine-tuning-lora-unsloth.md) | Fine-tuning: LoRA incremental + Unsloth | Aceito |
| [ADR-008](./008-frontend-angular.md) | Frontend: Angular standalone + signals | Aceito |
| [ADR-009](./009-armazenamento-documentos.md) | Armazenamento: PostgreSQL + volume local | Aceito |
| [ADR-010](./010-seguranca-dados-lgpd.md) | Segurança e LGPD | Aceito |
