#!/usr/bin/env bash
# smoke-rag.sh — Verifica o pipeline completo: upload → worker → índice Qdrant
# Uso: bash scripts/smoke-rag.sh
# Requer: API + embedding + document-processor + qdrant rodando via docker compose
# Variáveis de ambiente opcionais:
#   API_URL (default: http://localhost:3000)
#   SMOKE_EMAIL / SMOKE_PASS (default: gerados com timestamp)
#   RAG_TIMEOUT_SECS (default: 90)

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
SMOKE_EMAIL="${SMOKE_EMAIL:-smokerag_$(date +%s)@test.local}"
SMOKE_PASS="${SMOKE_PASS:-SmokeRag@1234}"
TIMEOUT="${RAG_TIMEOUT_SECS:-90}"

ok()   { echo "[OK]  $*"; }
fail() { echo "[FAIL] $*" >&2; exit 1; }

# 1. Registro + Login
echo "--- 1. Registro e login ---"
curl -sf -X POST "${API_URL}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"workspace_name\":\"SmokeRAG\",\"name\":\"Smoke\",\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASS}\"}" \
  > /tmp/smoke_reg.json || fail "register falhou"

LOGIN=$(curl -sf -X POST "${API_URL}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASS}\"}")
TOKEN=$(python3 -c "import json,sys; print(json.load(sys.stdin)['token'])" <<< "$LOGIN")
[ -n "$TOKEN" ] || fail "token ausente no login"
ok "login com owner token"

AUTH="-H \"Authorization: Bearer ${TOKEN}\""

# 2. Admin desbloqueado para owner
echo "--- 2. Admin acessível para owner ---"
CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "${API_URL}/api/v1/admin/health")
[ "$CODE" = "200" ] || fail "GET /admin/health retornou ${CODE} (owner deve ter acesso)"
ok "GET /admin/health → 200"

# 3. Fluxo de projeto
echo "--- 3. Fluxo de projeto ---"
PROJ=$(curl -sf -X POST "${API_URL}/api/v1/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Projeto RAG","description":"Criado pelo smoke-rag.sh"}')
PID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" <<< "$PROJ")
ok "projeto criado: ${PID}"

# Cria chat via POST /chats com project_id
CHAT=$(curl -sf -X POST "${API_URL}/api/v1/chats" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"Chat Smoke\",\"project_id\":\"${PID}\"}")
CID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" <<< "$CHAT")
ok "chat criado: ${CID}"

# Lista chats do projeto
CHATS=$(curl -sf "${API_URL}/api/v1/projects/${PID}/chats" \
  -H "Authorization: Bearer ${TOKEN}")
python3 -c "
import json,sys
chats=json.loads(sys.argv[1])
assert any(c['id']=='${CID}' for c in chats), 'chat nao aparece em /projects/${PID}/chats'
print('[OK]  GET /projects/${PID}/chats → chat presente')
" "$CHATS"

# Cria instrução
curl -sf -X POST "${API_URL}/api/v1/projects/${PID}/instructions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Inst","content":"Responda em portugues.","trigger_mode":"always","is_active":true}' \
  > /dev/null
INSTS=$(curl -sf "${API_URL}/api/v1/projects/${PID}/instructions" \
  -H "Authorization: Bearer ${TOKEN}")
python3 -c "
import json,sys
insts=json.loads(sys.argv[1])
assert any(i['name']=='Smoke Inst' for i in insts), 'instrucao nao aparece'
print('[OK]  instrucao criada e listada')
" "$INSTS"

# 4. Upload de documento
echo "--- 4. Upload e pipeline RAG ---"
TXT_FILE=$(mktemp /tmp/smoke_doc_XXXXXX.txt)
echo "BTV Chat Corp smoke test. Este texto deve ser indexado pelo document-processor." > "${TXT_FILE}"

UPLOAD=$(curl -sf -X POST "${API_URL}/api/v1/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${TXT_FILE};type=text/plain")
DID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" <<< "$UPLOAD")
ok "documento enviado: ${DID}"

# Vincula ao projeto
curl -sf -X POST "${API_URL}/api/v1/projects/${PID}/documents" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"document_id\":\"${DID}\"}" > /dev/null
ok "documento vinculado ao projeto"

# Lista documentos do projeto (deve aparecer)
DOCS=$(curl -sf "${API_URL}/api/v1/projects/${PID}/documents" \
  -H "Authorization: Bearer ${TOKEN}")
python3 -c "
import json,sys
docs=json.loads(sys.argv[1])
assert any(d['id']=='${DID}' for d in docs), 'documento nao aparece em /projects/${PID}/documents'
print('[OK]  GET /projects/${PID}/documents → documento presente com linked_at')
assert docs[0].get('linked_at') is not None, 'linked_at ausente'
" "$DOCS"

# 5. Poll até o worker processar
echo "--- 5. Poll processing_status (timeout ${TIMEOUT}s) ---"
ELAPSED=0
while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  STATUS=$(curl -sf "${API_URL}/api/v1/documents/${DID}" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -c "import json,sys; print(json.load(sys.stdin)['processing_status'])" 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "completed" ]; then
    ok "processing_status=completed (${ELAPSED}s)"
    break
  fi
  if [ "$STATUS" = "failed" ]; then
    fail "processing_status=failed — verifique logs do document-processor"
  fi
  echo "  status=${STATUS} (${ELAPSED}s)..."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done
[ "$STATUS" = "completed" ] || fail "timeout: documento ainda em status=${STATUS} após ${TIMEOUT}s"

# Verifica chunk_count > 0
CHUNK_COUNT=$(curl -sf "${API_URL}/api/v1/documents/${DID}" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('chunk_count',0))")
[ "${CHUNK_COUNT}" -gt 0 ] || fail "chunk_count=${CHUNK_COUNT} — documento indexado sem chunks"
ok "chunk_count=${CHUNK_COUNT} > 0"

rm -f "${TXT_FILE}"
echo ""
echo "=== smoke-rag.sh PASSOU ==="
