#!/usr/bin/env bash
# Verifica saúde de todos os serviços
set -euo pipefail

# Apenas serviços que existem no docker-compose.yml de hoje.
# (redis/vllm/rag-searcher serão adicionados em TKT-008 — ver docs/roadmap_v1.md.)
SERVICES=(postgres qdrant embedding document-processor api frontend nginx)

echo "🔍 BTV Chat Corp — Health Check"
echo "================================"

all_ok=true
for svc in "${SERVICES[@]}"; do
  # Usa Health quando há healthcheck definido; senão cai para State (running = ok).
  status=$(docker compose ps --format json "$svc" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health') or d.get('State','unknown'))" 2>/dev/null || echo "unknown")
  if [[ "$status" == "healthy" || "$status" == "running" ]]; then
    echo "✅ $svc: $status"
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
