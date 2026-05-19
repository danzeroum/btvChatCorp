# Sprint 1 — Grupo B: Banco de Dados

**Branch:** `fix/s1-migrations`  
**Issues:** #9 (B1)  
**Semana:** 1, Dias 3–5  
**Dependência:** Mergear após `fix/s1-compilabilidade`

## Contexto do problema (Split-Brain)

Três diretórios de migrations incompatíveis:

| Diretório | Status | Ação |
|---|---|---|
| `backend/migrations/` | **ATIVO** — manter | Complementar com tabelas faltantes |
| `database/migrations/` | Órfão | Deletar |
| `backend/crates/api/migrations/` | Órfão | Deletar |

## Tabelas a incluir no schema consolidado

Tabelas no schema ativo (`backend/migrations/`) + tabelas nos schemas órfãos:
- `roles`
- `sessions`  
- `audit_log`
- `api_keys`
- `usage_events`
- `workspace_ai_config`

## Estrutura final esperada

```
backend/migrations/
├── 001_inicial.sql          ← schema consolidado completo
├── 002_rag_columns.sql      ← já existe (PR #1)
└── 003_branding_onboarding.sql  ← já existe (PR #2)
```

## Comandos de validação

```bash
# Rodar migrations do zero:
sqlx migrate run

# Verificar tabelas criadas:
psql $DATABASE_URL -c '\dt'

# Verificar tabelas específicas:
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

## Atenção

- Usar `IF NOT EXISTS` em todos os `CREATE TABLE`
- Se houver dados em produção: criar `ALTER TABLE` em vez de recriar
- Documentar cada tabela com comentários SQL
