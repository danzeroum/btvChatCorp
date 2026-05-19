# Sprint 1 — Grupo A: Compilabilidade

**Branch:** `fix/s1-compilabilidade`  
**Issues:** #6 (B2), #7 (B3), #8 (B4)  
**Semana:** 1, Dias 1–3

## Ordem de execução

1. **#6 B2** — Corrigir dependências Rust primeiro (sem isso o projeto não compila)
2. **#7 B3** — Remover código morto (com projeto compilando é mais seguro deletar)
3. **#8 B4** — Limpar stubs Python (limpeza final, não afeta compilação Rust)

## Comandos de validação

```bash
# Após cada crate corrigido:
cargo check --workspace

# Validação final:
cargo build --workspace

# Verificar que não sobrou código Python:
find . -name '*.py' | grep -v backend/training
```

## Arquivos a deletar (B3)

### Rotas órfãs
- `backend/crates/api/src/routes/admin.rs`
- `backend/crates/api/src/routes/chat.rs`
- `backend/crates/api/src/routes/feedback.rs`
- `backend/crates/api/src/routes/search.rs`
- `backend/crates/api/src/routes/usage.rs`
- `backend/crates/api/src/routes/webhooks.rs`

### Middlewares órfãos
- `backend/crates/api/src/middleware/api_key_auth.rs`
- `backend/crates/api/src/middleware/admin_guard.rs`
- `backend/crates/api/src/middleware/audit_logger.rs`
- `backend/crates/api/src/middleware/request_logger.rs`
- `backend/crates/api/src/middleware/rate_limiter.rs`
- `backend/crates/api/src/middleware/usage_tracker.rs`

### Models e Services
- `backend/crates/api/src/models/admin.rs`
- `backend/crates/api/src/services/admin_service.rs`

## Arquivos a deletar (B4)

- `backend/app/` (inteiro)
- `backend/requirements.txt`
- `training/` (raiz do projeto — não confundir com `backend/training/`)
