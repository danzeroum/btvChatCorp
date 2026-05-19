# Sprint 3 — Grupo B: Escalabilidade

## Issues
- #37 A1: Paginação cursor-based em 7 endpoints
- #38 Novo: Corrigir versão Qdrant v1.13.0

## Ordem de execução
1. #38 — Qdrant primeiro (garantir que RAG continua funcional)
2. #37 — Paginação (criar struct genérica PaginatedResponse<T>)

## Critério de aceitação
- Qdrant v1.13.0 em todos os compose files
- 7 endpoints com next_cursor e has_more
- limit default 20, máximo 100
