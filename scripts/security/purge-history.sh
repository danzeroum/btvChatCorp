#!/usr/bin/env bash
#
# Purga credenciais vazadas e identidades de infra do histórico git.
#
# Reescreve TODO o histórico de TODAS as branches/tags:
#   1. Substitui o segredo vazado (lido de $LEAKED_SECRET) por ***REMOVED***
#      tanto no conteúdo dos arquivos quanto nas mensagens de commit.
#   2. Remapeia os e-mails/identidades de infra para a identidade canônica.
#
# ATENÇÃO — OPERAÇÃO DESTRUTIVA:
#   - Reescreve todos os hashes de commit.
#   - Exige `git push --force` em TODAS as branches (inclui main).
#   - Quebra clones e PRs abertos: quem tiver clone precisa re-clonar.
#   - NÃO substitui a ROTAÇÃO do segredo no servidor (faça isso ANTES).
#
# Pré-requisitos:
#   - git-filter-repo instalado (pip install git-filter-repo)
#   - Rodar em um clone FRESCO e ESPELHADO do repositório:
#       git clone --mirror git@github.com:danzeroum/btvChatCorp.git
#       cd btvChatCorp.git
#   - Exportar o segredo vazado SEM commitá-lo:
#       export LEAKED_SECRET='a-senha-que-vazou'
#
# Uso:
#   LEAKED_SECRET='...' ./purge-history.sh
#
set -euo pipefail

: "${LEAKED_SECRET:?Defina LEAKED_SECRET com a senha vazada (não commite este valor)}"
# Lista separada por vírgula dos e-mails/identidades de infra a ocultar.
# Ex.: INFRA_IDENTITIES='root@servidor.exemplo,segundo@email.com'
# Mantido fora do repositório de propósito.
: "${INFRA_IDENTITIES:?Defina INFRA_IDENTITIES (e-mails antigos a remapear, separados por vírgula)}"
CANON_NAME="${CANON_NAME:-DANIEL LAU PEREIRA SOARES}"
CANON_EMAIL="${CANON_EMAIL:-danniellau@gmail.com}"

if ! git filter-repo --version >/dev/null 2>&1; then
  echo "ERRO: git-filter-repo não encontrado. Instale com: pip install git-filter-repo" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 1) Substituições de texto (conteúdo de arquivos E mensagens de commit).
REPLACE="$WORK/replacements.txt"
printf '%s==>***REMOVED***\n' "$LEAKED_SECRET" > "$REPLACE"

# 2) Remapeamento de identidades de infra -> identidade canônica.
MAILMAP="$WORK/mailmap"
: > "$MAILMAP"
IFS=',' read -ra _ids <<< "$INFRA_IDENTITIES"
for _old in "${_ids[@]}"; do
  _old="$(echo "$_old" | xargs)"   # trim
  [ -z "$_old" ] && continue
  printf '%s <%s> <%s>\n' "$CANON_NAME" "$CANON_EMAIL" "$_old" >> "$MAILMAP"
done

echo ">> Reescrevendo histórico (conteúdo + mensagens + identidades)..."
git filter-repo \
  --replace-text "$REPLACE" \
  --replace-message "$REPLACE" \
  --mailmap "$MAILMAP" \
  --force

echo
echo ">> Histórico reescrito localmente. Verificação:"
if git grep -I "$LEAKED_SECRET" $(git rev-list --all) >/dev/null 2>&1; then
  echo "   FALHA: segredo ainda encontrado no histórico." >&2
  exit 1
fi
echo "   OK: segredo não encontrado em nenhum commit."

cat <<'NEXT'

>> PRÓXIMOS PASSOS (manuais — confirme antes de force-push):
   git remote add origin git@github.com:danzeroum/btvChatCorp.git   # filter-repo remove o remote
   git push --force --all origin
   git push --force --tags origin

>> DEPOIS DO PUSH:
   - Rotacione o segredo no servidor (se ainda não fez).
   - Peça ao GitHub Support para limpar caches/views de PRs antigos.
   - Avise quem tiver clones para re-clonar.
NEXT
