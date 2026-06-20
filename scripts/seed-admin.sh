#!/bin/bash
set -euo pipefail

# Cria usuário admin se não existir.
# Requer: ADMIN_PASS e ADMIN_EMAIL definidos no ambiente ou .env
ADMIN_PASS="${ADMIN_PASS:?Erro: ADMIN_PASS obrigatorio — ex: ADMIN_PASS=xxx ./scripts/seed-admin.sh}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@btv.com}"
ADMIN_NAME="${ADMIN_NAME:-Admin}"
WORKSPACE_NAME="${WORKSPACE_NAME:-BTV Corp}"

# Usa os mesmos defaults do docker-compose.yml (POSTGRES_USER=btv, POSTGRES_DB=btvchat).
PG_USER="${POSTGRES_USER:-btv}"
PG_DB="${POSTGRES_DB:-btvchat}"
EXISTING=$(docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -t -c "SELECT count(*) FROM users;" | tr -d ' ')

if [ "$EXISTING" -gt "0" ]; then
  echo "Usuarios ja existem ($EXISTING). Nenhuma acao necessaria."
  exit 0
fi

echo "Criando usuario admin..."
docker compose exec api curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${ADMIN_NAME}\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASS}\",\"workspace_name\":\"${WORKSPACE_NAME}\"}"
echo ""
echo "Admin criado: ${ADMIN_EMAIL}"
