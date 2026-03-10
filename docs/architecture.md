# Arquitetura da Plataforma BTV Chat Corp

## Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                     │
│              Angular 17 + TailwindCSS                    │
└─────────────────────────┬───────────────────────────────┘
                          │ SSE / REST / WebSocket
┌─────────────────────────▼───────────────────────────────┐
│                  BACKEND (Rust/Axum)                     │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐  │
│  │   Auth   │  │   Chat   │  │  RAG   │  │ Webhooks │  │
│  │ JWT/SSO  │  │ Handler  │  │Qdrant  │  │Dispatcher│  │
│  └──────────┘  └──────────┘  └────────┘  └──────────┘  │
└──────────────────────┬──────────────────────────────────┘
           ┌───────────┴───────────┐
           │                       │
┌──────────▼──────────┐  ┌────────▼────────────┐
│   PostgreSQL         │  │   vLLM (GPU)        │
│  - users             │  │  Llama 3.3 70B      │
│  - chat_sessions     │  │  + LoRA adapters    │
│  - training_data     │  │  (por workspace)    │
│  - audit_logs        │  └─────────────────────┘
│  - api_keys          │
│  - webhooks          │  ┌─────────────────────┐
└──────────────────────┘  │   Qdrant            │
                          │  Vector DB          │
                          │  (por workspace)    │
                          └─────────────────────┘
```

## Fluxo de uma Mensagem

1. **Usuário digita** → Frontend aplica pipeline de 5 estágios (sanitize → detectPII → classify → anonymize → enrich)
2. **Backend recebe** → Valida JWT + workspace context
3. **RAG Pipeline** → Embeds query → busca docs similares no Qdrant
4. **Prompt Builder** → Monta: system prompt + contexto RAG + histórico + regras
5. **vLLM** → Gera resposta com LoRA do workspace (streaming SSE)
6. **Coleta** → Salva par pergunta/resposta em `training_interactions`
7. **Feedback** → Usuário dá 👍/👎 → curador aprova → entra no próximo ciclo

## Ciclo de Treinamento Contínuo

```
Interações diárias
      ↓
Coleta (thumbs up + correções + Q&A sintéticos)
      ↓
Curadoria no painel admin
      ↓
Fine-tuning LoRA (madrugada, ~30min, Unsloth)
      ↓
Avaliação automática (benchmark do workspace)
      ↓
Hot-swap no vLLM (zero downtime)
      ↓
Modelo mais inteligente → mais feedback → ciclo continua
```

## Multi-Tenancy

- Cada workspace tem sua **collection separada no Qdrant**
- Cada workspace tem seu **LoRA adapter** treinado nos seus dados
- Dados de um workspace **nunca vazam** para outro
- Billing e rate limiting por workspace

## Segurança e Compliance

- PII detectado e anonimizado **antes de sair do browser**
- Dados `RESTRICTED` nunca entram no pipeline de treino
- Audit log imutável de todas as ações
- Relatório LGPD gerado em 1 clique
- SSO com OIDC/SAML/LDAP (sem senha armazenada para usuários SSO)
