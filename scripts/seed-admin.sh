#!/bin/bash
# Cria usuário admin se não existir
EXISTING=$(docker compose exec -T postgres psql -U btvchat -d btvchat -t -c "SELECT count(*) FROM users;" | tr -d ' ')

if [ "$EXISTING" -gt "0" ]; then
  echo "✅ Usuários já existem ($EXISTING). Nenhuma ação necessária."
  exit 0
fi

echo "🔧 Criando usuário admin..."
docker compose exec api curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@btv.com","password":"Admin123!","workspace_name":"BTV Corp"}'
echo ""
echo "✅ Admin criado: admin@btv.com / Admin123!"
