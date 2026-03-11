# ADR-010 — Segurança e LGPD

**Status:** Aceito  
**Data:** 2026-03

## Contexto

O sistema processa dados corporativos potencialmente sensíveis (contratos, RH, dados financeiros) e está sujeito à LGPD (Lei 13.709/2018). Dados de interações são usados para fine-tuning — o que cria responsabilidade adicional sobre o que é treinado.

## Decisões

### 1. Detecção de PII antes do treino
Todo dado candidato ao fine-tuning passa pelo **Microsoft Presidio** para detectar e sinalizar PII (CPF, CNPJ, e-mail, telefone, nome próprio). Dados com PII detectado ficam bloqueados para treino até revisão manual do curador.

### 2. Criptografia de dados sensíveis
- Campos sensíveis no banco (tokens, chaves) criptografados com **AES-256-GCM** em repouso
- TLS 1.2+ obrigatório em todas as conexões (nginx enforce)
- Refresh tokens em `httpOnly` cookie — inacessível via JavaScript

### 3. Audit log imutável
Todas as ações relevantes (login, upload, treino, deploy de modelo, acesso a dados) são registradas na tabela `audit_logs` com `INSERT ONLY` — sem UPDATE/DELETE via aplicação.

### 4. Retenção e direito ao esquecimento
- Configuração por workspace: retenção de interações (30/60/90/180 dias)
- `DELETE /users/:id/data` remove todas as mensagens, interações de treino e dados pessoais do usuário
- Chunks de documentos são deletados do Qdrant quando o documento é removido

### 5. Isolamento entre workspaces
- Toda query ao banco inclui `WHERE workspace_id = ?` — sem acesso cruzado via aplicação
- LoRA adapters armazenados em diretórios isolados por `workspace_id`
- Qdrant usa `payload filter` por `workspace_id` em todas as buscas

## Consequências

**Positivas:**
- Conformidade com LGPD artigos 6º (finalidade), 15º (término do tratamento) e 18º (direitos do titular)
- Audit log permite responder a incidentes e auditorias externas
- PII gate impede que dados sensíveis entrem no modelo por descuido

**Negativas / Trade-offs:**
- Curadoria manual de PII aumenta o tempo antes de um dado poder ser treinado
- Audit log cresce continuamente — necessita política de arquivamento após 2 anos
