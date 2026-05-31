# BTV Chat Corp — Plataforma de IA Privada Enterprise

Plataforma completa de IA privada enterprise com:

- **Frontend**: Angular 17+ com SSE streaming, feedback, upload, painel admin
- **Backend**: Rust/Axum (runtime principal) com RAG (Qdrant), LLM, multi-tenancy, SSO
- **Document Processor**: Rust worker para ingestão e indexação de documentos
- **API Pública**: OpenAI-compatible REST API com API keys e webhooks
- **White-Label**: Branding completo por workspace

## Estrutura

```
├── frontend/          # Angular 17 (TypeScript)
├── backend/           # Rust/Axum — monorepo de crates
│   ├── crates/api              # API principal (auth, chat, documents, admin)
│   ├── crates/api-public       # API pública OpenAI-compat
│   ├── crates/document-processor  # Worker de ingestão de documentos
│   ├── crates/rag-searcher     # Busca vetorial + context expansion
│   ├── crates/ai-orchestrator  # Orquestração LLM
│   ├── crates/branding         # White-label CSS generator
│   ├── crates/webhooks         # Webhook dispatcher
│   └── crates/onboarding       # Wizard de onboarding
├── backend/migrations/         # Migrations PostgreSQL (canônicas)
├── backend/services/           # Microserviços Python (embedding, reranker)
└── docs/                       # Documentação de arquitetura (ADRs)
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 17, SSE, standalone components |
| Backend (runtime principal) | Rust, Axum 0.7, Tokio, sqlx |
| Banco de dados | PostgreSQL 16 + pgvector |
| Banco vetorial | Qdrant |
| Embeddings | Nomic Embed V2 MoE (Python/FastAPI) |
| Reranking | CrossEncoder ms-marco (Python/FastAPI) |
| LLM | Ollama / API compatível |
| Auth/SSO | JWT HS256 + OIDC/SAML/LDAP |
| Webhooks | Async Rust + HMAC-SHA256 signing |

## Início Rápido

```bash
# Backend
cd backend && cargo run

# Frontend
cd frontend && npm install && ng serve
```

## Primeiro acesso

Após subir os containers, crie o usuário admin:

```bash
ADMIN_PASS="<senha-segura>" ./scripts/seed-admin.sh
```

> A senha deve ser definida via variável de ambiente `ADMIN_PASS`.
> O script recusa executar sem ela para evitar senhas padrão inseguras.
