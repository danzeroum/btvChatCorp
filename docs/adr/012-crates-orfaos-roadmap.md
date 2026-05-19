# ADR-012: Crates Órfãos — Roadmap de Ativação

**Data:** 2026-05-19
**Status:** ACEITO
**Contexto:** Sprint 4 — Revisão de lacunas

## Contexto

Após a análise cruzada do repositório, identificou-se que os crates
`ai-orchestrator` e `webhooks` estão presentes em `backend/crates/` mas
não fazem parte do workspace `Cargo.toml`. Isso os torna órfãos: existem
no filesystem mas não são compilados nem testados.

O crate `api-public` e `rag-searcher` foram ativados na Sprint 4 e Sprint 4+
respectivamente.

## Decisão

Manter `ai-orchestrator` e `webhooks` **fora do workspace** até a Sprint 5,
quando serão:

1. **`webhooks`**: refatorado para usar contratos de evento definidos em
   `shared-types` (novo crate a criar). Ativado quando o portal de parceiros
   precisar de notificações de evento (workspace criado, treinamento concluído).

2. **`ai-orchestrator`**: ativado quando a pipeline RAG + fine-tuning estiver
   estabilizada e precisar de orquestração entre `rag-searcher`, `vllm` e
   `training`. Depende do docker-compose `--profile full` estar validado.

## Consequências

- **Positivo**: workspace compila limpo sem crates quebrados.
- **Positivo**: escopo de Sprint 5 já pré-definido.
- **Negativo**: funcionalidades de webhook e orquestração indisponíveis até Sprint 5.
- **Mitigação**: BTV Gateway já tem rate limiting e autenticação independentes,
  reduzindo urgência dos webhooks.

## Alternativas Rejeitadas

- Ativar agora com stubs vazios: gera falsos positivos no CI (zero testes).
- Deletar os crates: perde trabalho existente que pode ser aproveitado.
