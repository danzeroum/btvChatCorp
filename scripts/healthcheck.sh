#!/usr/bin/env bash
# Verifica saúde de todos os serviços
set -euo pipefail

SERVICES=(postgres redis qdrant vllm embedding api rag-searcher nginx)

echo "🔍 BTV Chat Corp — Health Check"
echo "================================"

all_ok=true
for svc in "${SERVICES[@]}"; do
  status=$(docker compose ps --format json "$svc" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health','unknown'))" 2>/dev/null || echo "unknown")
  if [[ "$status" == "healthy" ]]; then
    echo "✅ $svc: healthy"
  else
    echo "❌ $svc: $status"
    all_ok=false
  fi
done

echo ""
if $all_ok; then
  echo "✅ Todos os serviços estão saudáveis."
else
  echo "⚠️  Alguns serviços precisam de atenção."
  exit 1
fi
