# BTV Chat Corp — Plataforma de IA Privada Enterprise

Plataforma completa de IA privada enterprise com:

- **Frontend**: Angular 17+ com SSE streaming, feedback, upload, painel admin
- **Backend**: Rust/Axum com RAG (Qdrant), vLLM, multi-tenancy, SSO
- **Treinamento**: Fine-tuning contínuo com LoRA (Unsloth/TRL)
- **API Pública**: OpenAI-compatible REST API com API keys e webhooks
- **White-Label**: Branding completo por workspace

## Estrutura

```
├── frontend/          # Angular (TypeScript)
├── backend/           # Rust/Axum
├── training/          # Python (Unsloth, TRL, LoRA)
├── database/          # SQL Migrations (PostgreSQL)
└── docs/              # Documentação de arquitetura
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 17, SSE, TailwindCSS |
| Backend | Rust, Axum, Tokio |
| Banco de dados | PostgreSQL + Qdrant (vetores) |
| Modelo de IA | vLLM + Llama 3.3 70B + LoRA |
| Embeddings | Nomic Embed V2 |
| Auth/SSO | JWT + OIDC/SAML/LDAP |
| Webhooks | Async Rust + HMAC signing |

## Início Rápido

```bash
# Backend
cd backend && cargo run

# Frontend
cd frontend && npm install && ng serve

# Training pipeline
cd training && pip install -r requirements.txt
python continuous_trainer.py
```
