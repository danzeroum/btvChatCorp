# Sprint 3 — Grupo A: CI/CD e Qualidade

## Issues
- #34 A3: Pipeline CI/CD GitHub Actions (lint, test, build, security, deploy)
- #35 A2: Rate limiting com governor (100/min chat, 20/min treino)
- #36 A4: Atualizar ADRs (ADR-003 SUPERSEDED, criar ADR-011)

## Ordem de execução
1. A4 — Atualizar ADRs (baixo risco, entrar no contexto)
2. A2 — Rate limiting (revisar governor, integrar AppState)
3. A3 — CI/CD (implementar por último para que testes já existam)

## Critério de aceitação
- CI pipeline verde no GitHub Actions
- Rate limiting ativo com HTTP 429
- ADR-003 SUPERSEDED + ADR-011 criado
