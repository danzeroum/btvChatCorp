# ADR-001 — LLM: vLLM + Llama 3.3 70B Instruct

**Status:** Aceito como alvo de escala — **runtime atual: Ollama externo** (ver "Atualização" no fim)  
**Data:** 2026-03 (atualizado 2026-06)

## Contexto

O sistema precisa de um LLM capaz de responder perguntas em português sobre documentos corporativos, com suporte a fine-tuning incremental por workspace e streaming de respostas em tempo real. A operação deve ser 100% on-premise para garantir privacidade dos dados.

## Decisão

Usar **Llama 3.3 70B Instruct** servido via **vLLM** com suporte a **LoRA hot-swap** por workspace.

- vLLM foi escolhido por ter a maior throughput entre servidores OpenAI-compatíveis (PagedAttention)
- Llama 3.3 70B foi escolhido por performance em português e suporte a contexto de 128k tokens
- LoRA hot-swap permite que cada workspace tenha seu próprio adapter sem reiniciar o servidor
- A API é compatível com OpenAI SDK, facilitando integrações externas

## Consequências

**Positivas:**
- Alta throughput com PagedAttention (vLLM)
- Fine-tuning por workspace sem downtime
- API OpenAI-compatível — fácil integração via SDK padrão
- Total controle dos dados (sem envio para terceiros)

**Negativas / Trade-offs:**
- Requer mínimo 2x H100 80GB para rodar 70B em float16
- Tempo de startup do modelo ~2 min na primeira carga
- Custo de hardware elevado vs. APIs de terceiros (OpenAI, Claude)

## Atualização (2026-06) — runtime atual: Ollama externo

> **Status revisado:** decisão mantida como **alvo de escala**, mas o **runtime
> atual usa Ollama externo (VPS)**, não vLLM local.

Decisão operacional (alinhada com o dono do produto): nesta fase o LLM roda em um
**Ollama externo**, configurável via `OLLAMA_URL`. Isso evita a exigência de
2×H100 e mantém o app **inteiro em Docker, sem GPU**. O caminho vLLM + Llama 3.3
70B desta ADR continua válido e fica disponível como **profile opt-in de GPU** no
compose (`vllm`/`training`), a ser ativado quando houver hardware dedicado
(pendência **P-06**).

- **Hoje:** `OLLAMA_URL` → Ollama (modelo configurável, ex.: `llama3.2:3b`).
- **Escala:** profile `vllm` (GPU) servindo Llama 70B — sem mudança de código na
  API, pois ambos expõem API compatível com OpenAI/Ollama.
- ADR-005 (pipeline RAG) e ADR-007 (fine-tuning) dependem deste mesmo runtime.

Esta atualização resolve a divergência ADR↔runtime apontada na auditoria (TKT-021).
