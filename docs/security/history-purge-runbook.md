# Runbook — Purga de segredo e identidades do histórico git

> Pré-publicação do repositório como **público**. O working tree atual já está
> limpo; este runbook trata do **histórico git**, que um repositório público
> também expõe.

## Contexto

A auditoria encontrou **uma credencial real** versionada em commits antigos
(default hardcoded de `OLLAMA_AUTH_PASS` no `docker-compose.yml` /
`docker-compose.dev.yml`, presente em ~49 commits e citada na mensagem do
commit `db25045`). Além disso, metadados de commit expõem:

- um committer cujo e-mail é o hostname de um VPS de produção (revela o servidor);
- um e-mail secundário do autor.

Os valores reais a remapear **não** ficam versionados: você os passa em runtime
via `INFRA_IDENTITIES` (veja abaixo). O e-mail `danniellau@gmail.com` foi
autorizado a permanecer como referência canônica.

## Ordem de execução

### 0. ROTACIONAR o segredo (faça primeiro, sempre)

Trocar a senha `OLLAMA_AUTH_PASS` no servidor Ollama de produção. Reescrever o
histórico **não** desfaz o vazamento — qualquer clone/fork/cache já feito pode
conter o valor. Só a rotação elimina o risco real.

### 1. Reescrever o histórico

Requer `git-filter-repo`. Rode em um clone **espelhado e fresco**:

```bash
pip install git-filter-repo

git clone --mirror git@github.com:danzeroum/btvChatCorp.git
cd btvChatCorp.git

# NÃO commite estes valores em lugar nenhum:
export LEAKED_SECRET='a-senha-que-vazou'
export INFRA_IDENTITIES='root@host-do-vps,email-secundario@exemplo.com'

/caminho/para/scripts/security/purge-history.sh
```

O script:
- substitui o segredo por `***REMOVED***` no conteúdo dos arquivos **e** nas
  mensagens de commit;
- remapeia cada identidade de `INFRA_IDENTITIES` para a identidade canônica
  `DANIEL LAU PEREIRA SOARES <danniellau@gmail.com>` (ajustável via
  `CANON_NAME` / `CANON_EMAIL`);
- valida que o segredo não aparece mais em nenhum commit.

### 2. Force-push de TODAS as branches/tags

> Operação destrutiva: reescreve todos os hashes e quebra clones/PRs abertos.

```bash
git remote add origin git@github.com:danzeroum/btvChatCorp.git
git push --force --all origin
git push --force --tags origin
```

### 3. Pós-purga

- Peça ao **GitHub Support** para expirar caches e views de PRs antigos
  (a UI de PRs pode reter blobs com o segredo mesmo após o force-push).
- Feche/recrie PRs abertos que dependam dos hashes antigos.
- Avise colaboradores a **re-clonar** (clones antigos preservam o histórico sujo).

## Por que isto não pode ser feito só na branch de feature

O segredo está em commits que pertencem ao histórico do `main`. Limpar apenas
uma branch de feature não remove os commits do `main` no repositório remoto.
A purga só é efetiva reescrevendo **e** dando force-push em `main` (e demais
refs) — uma ação de administrador sobre a branch principal.
