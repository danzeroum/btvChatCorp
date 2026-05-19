# Sprint 1 — Grupo D: Infraestrutura

**Branch:** `fix/s1-infra`  
**Issues:** #15 (T3 Parcial)  
**Semana:** 2, Dias 9–10  
**Dependência:** Mergear após `fix/s1-seguranca`

## Serviços do perfil `core`

| Serviço | Healthcheck | Dependência |
|---------|-------------|-------------|
| `postgres` | `pg_isready` | — |
| `qdrant` | `GET /health` | — |
| `redis` | `redis-cli ping` | — |
| `embedding` | embed de teste (modelo carregado) | — |
| `api` | `GET /api/v1/health` | postgres healthy + qdrant healthy + redis healthy |
| `frontend` | `GET /` | — |
| `nginx` | `GET /` | api healthy + frontend healthy |

## Template de healthcheck

```yaml
# postgres
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s

# redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 3s
  retries: 5

# qdrant
healthcheck:
  test: ["CMD-SHELL", "curl -sf http://localhost:6333/health || exit 1"]
  interval: 15s
  timeout: 5s
  retries: 5
  start_period: 15s

# embedding (aguarda modelo carregado)
healthcheck:
  test: ["CMD-SHELL", "curl -sf -X POST http://localhost:8001/embed -H 'Content-Type: application/json' -d '{\"texts\":[\"test\"]}' || exit 1"]
  interval: 20s
  timeout: 10s
  retries: 10
  start_period: 60s  # modelo Nomic demora para carregar

# api
depends_on:
  postgres:
    condition: service_healthy
  qdrant:
    condition: service_healthy
  redis:
    condition: service_healthy
```

## Serviços opcionais (Sprint 2)

Manter no docker-compose com profile diferente (`--profile full`):
- `vllm`
- `training`
- `document-processor`
- `reranker`
- `rag-searcher`

## Comandos de validação

```bash
# Subir apenas serviços core:
docker compose --profile core up -d

# Aguardar healthchecks (pode demorar 2-3 min na primeira vez):
docker compose ps
# Todos devem mostrar: healthy

# Verificar API:
curl http://localhost/api/v1/health
# Esperado: {"status": "ok"}

# Verificar nenhum serviço está reiniciando:
docker compose ps --format 'table {{.Name}}\t{{.Status}}'
```
