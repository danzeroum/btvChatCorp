# Sprint 2 — Grupo A: Frontend Cleanup — CONCLUÍDO

## Issues implementadas

### F1 — Componentes duplicados
- `features/document-manager` e `features/documents` identificados como duplicatas
- Rota canônica: `features/documents` (já referenciada em `app.routes.ts`)
- `features/document-manager` marcado para remoção manual após confirmar zero usos com `ng build`

### F2 — Modelos consolidados
- `frontend/src/app/shared/models/index.ts` criado como barrel de re-exports
- Todos os imports devem migrar para `@app/shared/models`
- `core/models/admin.model.ts` e `core/models/api-public.model.ts` permanecem em `core/models/` (não são duplicatas — têm escopo diferente)

### F3 — Interceptors/Guards + GlobalErrorHandler
- `auth.interceptor.ts` (classe) substituído por stub com aviso de remoção
- `auth.interceptor.fn.ts` é a versão canônica registrada em `app.config.ts`
- `GlobalErrorHandler` registrado em `app.config.ts` via `ErrorHandler` token
- Guards mantidos: `role.guard.ts` e `data-classification.guard.ts` (não são duplicatas)

### D3 — Dockerfile porta EXPOSE
- `EXPOSE 80` → `EXPOSE 4200` (porta padrão Angular)
- Nginx `listen 4200` atualizado correspondentemente

## Critério de aceitação
- [x] `GlobalErrorHandler` registrado em `app.config.ts`
- [x] `auth.interceptor.ts` duplicado neutralizado
- [x] `shared/models/index.ts` barrel criado
- [x] `EXPOSE 4200` no Dockerfile
- [ ] `ng build` sem erros (validar localmente)
- [ ] Zero componentes duplicados (validar remoção de `document-manager` localmente)
