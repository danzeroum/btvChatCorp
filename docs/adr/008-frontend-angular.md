# ADR-008 — Frontend: Angular 17+ com Standalone Components e Signals

**Status:** Aceito  
**Data:** 2026-03

## Contexto

O frontend precisa suportar chat em tempo real (WebSocket/SSE), upload de documentos com progresso, dashboards de curadoria de dados e painel administrativo. Precisa ser mantido por um time pequeno com foco em tipagem forte.

## Decisão

Usar **Angular 17+** com:
- **Standalone Components** (sem NgModules) — menos boilerplate, lazy loading por rota
- **Signals** para estado reativo local — substitui RxJS para estados simples
- **RxJS** mantido para streams complexos (WebSocket, SSE de streaming do chat)
- **Control Flow** (`@if`, `@for`) ao invés de diretivas estruturais

Alternativas avaliadas:

| Opção | Descartado por |
|-------|---------------|
| React + Next.js | Tipagem menos estrita, ecossistema mais fragmentado |
| Vue 3 | Time não tem experiência prévia |
| Svelte | Ecossistema menor, menos suporte enterprise |

## Consequências

**Positivas:**
- Tipagem forte end-to-end com TypeScript
- Lazy loading nativo por feature (training-dashboard, admin, chat)
- Signals reduzem a complexidade de RxJS para estado de UI simples

**Negativas / Trade-offs:**
- Curva de aprendizado maior que React para novos desenvolvedores
- Bundle inicial maior que frameworks mais leves (mitigado com lazy loading)
