# Sprint 4 — Grupo B: BTV Gateway

> Branch: `feat/s4-gateway`
> Issues: #50 (BTV Gateway OpenAI-compatible), #51 (Swagger + Postman + SDKs)
> Merge order: **2º** (após feat/s4-white-label)

## Escopo
- Ativar crate `api-public` no workspace
- Endpoints `/v1/chat/completions` e `/v1/embeddings` compatíveis com OpenAI
- Autenticação por API key (`X-API-Key` ou `Authorization: Bearer sk-btv-...`)
- Modo BYOK (`X-OpenAI-Key`)
- Subdomain dedicado: `api.btvc.com`
- Swagger UI em `api.btvc.com/docs`
- Collection Postman em `docs/api/btv-gateway.postman.json`
- Exemplos: curl, Python SDK, Node.js SDK

*Ref: btvChatCorp_Validacao_Cruzada_Sprints.pdf — Seção 4.5, P2 + P3*
