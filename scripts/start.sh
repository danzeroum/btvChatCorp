#!/usr/bin/env bash
# Inicia o stack completo de produção
set -euo pipefail

echo "🚀 BTV Chat Corp — Iniciando stack de produção..."

# Verifica .env
if [ ! -f .env ]; then
  echo "❌ .env não encontrado. Copie .env.example e preencha os valores."
  exit 1
fi

# Cria diretórios necessários
mkdir -p nginx/ssl logs/btv

# Verifica certificados SSL
if [ ! -f nginx/ssl/fullchain.pem ]; then
  echo "⚠️  Certificados SSL não encontrados em nginx/ssl/."
  echo "   Para desenvolvimento, gere com:"
  echo "   openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem -days 365 -nodes"
  exit 1
fi

# Pull e build
echo "📦 Fazendo build das imagens..."
docker compose build --parallel

# Sobe infraestrutura primeiro
echo "🗄️  Subindo infraestrutura (postgres, redis, qdrant)..."
docker compose up -d postgres redis qdrant
echo "⏳ Aguardando banco ficar saudável..."
docker compose wait postgres redis qdrant 2>/dev/null || sleep 20

# Sobe IA
echo "🤖 Subindo vLLM e Embedding..."
docker compose up -d vllm embedding
echo "⏳ Aguardando modelos carregarem (pode demorar ~2 min)..."
sleep 30

# Sobe serviços de backend
echo "⚙️  Subindo API, RAG Searcher, Document Processor..."
docker compose up -d api rag-searcher document-processor training

# Sobe frontend + nginx
echo "🌐 Subindo Frontend e Nginx..."
docker compose up -d frontend nginx

echo ""
echo "✅ Stack completo! Acesse: https://chat.seudominio.com"
echo "📊 Logs: docker compose logs -f --tail=50"
echo "📖 API docs: https://chat.seudominio.com/api-docs"
