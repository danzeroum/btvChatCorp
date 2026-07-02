# 🎯 BTV Chat Corp — Cola de Entrevista (1 página)

## Abertura (60s, para todos)
Plataforma de **IA privada enterprise** — "ChatGPT corporativo" self-hosted, RAG sobre
documentos internos **sem vazar dado para API pública** (LGPD/sigilo).
Stack: **Rust/Axum** (runtime) + **Python/FastAPI** (embedding/rerank) + **PostgreSQL+Qdrant** + **Angular 17**.
Escala: ~15k linhas Rust · 81 testes · 14 migrations · 42 endpoints · multi-tenant + white-label.

---

## 👤 Leônidas — EM / educador → DECISÕES
- Rust no runtime, Python só onde ML exige (separação por responsabilidade).
- **Disse "não"**: recusei linkar `ai-orchestrator` (dead code) — quebraria chat vivo + 11 testes.
- Honestidade: removi métricas fabricadas → estados zerados honestos.
- **Âncora:** "Documentei cada trade-off no roadmap e em 11 ADRs — decisão só vale se o próximo dev entende o porquê."

## 👤 Thiago — Senior Dev / qualidade → CÓDIGO
- Degradação graciosa em `rag.rs` (falhou embed/Qdrant/rerank → segue sem RAG). Bug BH-04 corrigido (token nunca vazio).
- SSE real (`chats.rs`): mpsc + stream token a token; título = `tokio::spawn` fire-and-forget.
- Over-fetch top_k*4 (clamp 50) + cross-encoder; reranker cai → no-op seguro.
- Webhook HMAC-SHA256 constant-time.
- **Âncora:** "Todo ponto de integração tem fallback e teste."

## 👤 Alexandre — PhD / governança → RISCO & LGPD
- Soberania por design: modelo privado, dado restrito fora do treino, PII no browser, audit log imutável.
- Isolamento multi-tenant: collection Qdrant por workspace + filtro `workspace_id`.
- **RLS honesto**: achei falha (session-level em pool → vaza entre tenants) → **provei a política, NÃO habilitei** o que não dá para verificar sob concorrência.
- **Âncora:** "Não afirmo garantia de segurança que ainda não consigo comprovar."

---

## ▶️ DEMO AO VIVO (20 segundos)
```bash
cargo test -p webhooks --lib        # 4 testes reais: HMAC + retry backoff → PASS
python3 scripts/poc_rag_pipeline.py # 18/18 provas do data-plane RAG
```
Fecho: a PoC reproduz o reorder `[b,c,a]` — **idêntico ao teste `reorder_by_scores_sorts_desc` do `rag.rs`**.

## 🗺️ Mapa rápido
| Pergunta sobre… | Perfil | Arquivo âncora |
|---|---|---|
| decisão/trade-off/time | Leônidas | `roadmap_v1.md`, `docs/adr/` |
| código/robustez/teste | Thiago | `rag.rs`, `chats.rs`, `webhooks/signer.rs` |
| risco/LGPD/isolamento | Alexandre | `architecture.md`, `docs/rls-plan.md` |

## ⚖️ Vivo vs. Roadmap (diga sempre!)
- **Vivo:** Ollama + RAG + rerank + webhooks + multi-tenant na aplicação.
- **Roadmap (profile GPU):** vLLM / LoRA / 70B / RLS estrito no banco.
