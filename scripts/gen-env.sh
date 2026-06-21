#!/usr/bin/env bash
# ============================================================
# gen-env.sh — bootstrap de desenvolvimento (1 comando)
# ------------------------------------------------------------
# 1) Gera um .env funcional a partir do .env.example, preenchendo todos os
#    segredos (POSTGRES_PASSWORD, JWT_SECRET, API_KEY_HMAC_SECRET,
#    INTERNAL_SERVICE_TOKEN, QDRANT_API_KEY, REDIS_PASSWORD) com valores fortes.
# 2) Gera um certificado TLS self-signed para o nginx (nginx/ssl/), se ausente.
#
# Assim o stack sobe com:
#     ./scripts/gen-env.sh && docker compose up -d
#
# Idempotente: nao sobrescreve .env nem o cert existentes (use --force p/ .env).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

FORCE="${1:-}"

hex32()  { openssl rand -hex 32; }
b64pass() { openssl rand -base64 24 | tr -d '/+=' ; }

# ---- 1) .env ----
if [ -f .env ] && [ "$FORCE" != "--force" ]; then
  echo "[gen-env] .env ja existe — mantido (use --force para regenerar)."
else
  PG_USER="btv"; PG_DB="btvchat"
  PG_PASS="$(b64pass)"
  JWT="$(hex32)$(hex32)"          # >= 64 chars
  API_HMAC="$(hex32)"
  INTERNAL="$(hex32)"
  QDRANT_KEY="$(hex32)"
  REDIS_PASS="$(hex32)"
  OLLAMA_DEFAULT="http://host.docker.internal:11434"

  cat > .env <<EOF
# Gerado por scripts/gen-env.sh em $(date -u +%Y-%m-%dT%H:%M:%SZ)
# NUNCA commite este arquivo (esta no .gitignore).

# ---- PostgreSQL ----
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=${PG_USER}
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=${PG_DB}
DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}

# ---- Qdrant ----
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=${QDRANT_KEY}

# ---- JWT / API keys ----
JWT_SECRET=${JWT}
JWT_EXPIRY_HOURS=1
API_KEY_HMAC_SECRET=${API_HMAC}

# ---- Servicos internos ----
INTERNAL_SERVICE_TOKEN=${INTERNAL}
EMBEDDING_MODEL_REVISION=main
EMBEDDING_MODEL=nomic-ai/nomic-embed-text-v2-moe
VLLM_URL=http://localhost:8000

# ---- Ollama / LLM (externo — VPS) ----
OLLAMA_HOST=${OLLAMA_DEFAULT}
OLLAMA_URL=${OLLAMA_DEFAULT}
OLLAMA_AUTH_USER=
OLLAMA_AUTH_PASS=
OLLAMA_MODEL=llama3.2:3b

# ---- SMTP (dev: mailpit) ----
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=

# ---- CORS ----
ALLOWED_ORIGINS=http://localhost:4200

# ---- Document worker ----
WORKER_POLL_INTERVAL_SECS=5
WORKER_CONCURRENCY=2
WORKER_MAX_RETRIES=3

# ---- Redis ----
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}

# ---- Logs ----
RUST_LOG=info
EOF
  chmod 600 .env
  echo "[gen-env] .env gerado com segredos aleatorios."
  echo "[gen-env] AJUSTE OLLAMA_URL para a URL do seu Ollama (VPS) antes de 'docker compose up'."
fi

# ---- 2) cert TLS self-signed para o nginx (gitignore: nginx/ssl/) ----
SSL_DIR="nginx/ssl"
if [ ! -f "$SSL_DIR/fullchain.pem" ]; then
  mkdir -p "$SSL_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$SSL_DIR/privkey.pem" -out "$SSL_DIR/fullchain.pem" \
    -days 365 -subj "/CN=localhost" >/dev/null 2>&1
  chmod 600 "$SSL_DIR/privkey.pem"
  echo "[gen-env] cert TLS self-signed gerado em $SSL_DIR/ (troque por ACME/Let's Encrypt em producao)."
else
  echo "[gen-env] cert TLS ja existe em $SSL_DIR/ — mantido."
fi
