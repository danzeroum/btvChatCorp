# Sprint 2 — Grupo B: Backend Core

## Issues
- #25 T1: Unificar pipeline de treinamento (`backend/training/`)
- #26 T2: Refatorar `admin_service.rs` — UserService, AuditService, BrandingService
- #27 T3: Completar docker-compose (vllm, training, document-processor, rag-searcher, reranker)

## Ordem de execução
1. T3 — docker-compose primeiro (infra necessária para testar T1)
2. T1 — Unificar pipeline após schema consolidado da Sprint 1
3. T2 — Refatorar admin_service (recriar do zero, não compilar o original)

## Pontos de atenção
- T1: verificar TODAS as queries SQL contra schema consolidado antes de concluir
- T2: priorizar MVP (UserService, AuditService, BrandingService)
- T3: GPU necessária para vllm e training; perfil `ollama` como fallback

## Critério de aceitação
- `cargo build --workspace` sem erros
- `docker compose --profile core up` sobe todos healthy
- Pipeline de treinamento executa ciclo completo
