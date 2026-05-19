# Sprint 2 — Grupo A: Frontend Cleanup

## Issues
- #21 F1: Remover 30+ componentes duplicados
- #22 F2: Consolidar modelos duplicados em `shared/models/`
- #23 F3: Eliminar interceptors/guards duplicados + registrar GlobalErrorHandler
- #24 D3: Corrigir porta EXPOSE no Dockerfile

## Ordem de execução
1. F1 — Deletar componentes mortos (verificar Find Usages antes de cada deleção)
2. F2 — Consolidar modelos em `shared/models/` e atualizar imports
3. F3 — Deletar interceptors/guards mortos + registrar GlobalErrorHandler
4. D3 — Corrigir porta EXPOSE

## Critério de aceitação
- `ng build` sem erros
- Zero componentes duplicados
- Zero modelos duplicados em `shared/models/`
- GlobalErrorHandler registrado em `app.config.ts`
- Frontend acessível após `docker compose up`
