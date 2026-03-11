# ADR-001 — LLM: vLLM + Llama 3.3 70B Instruct

**Status:** Aceito  
**Data:** 2026-03

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
