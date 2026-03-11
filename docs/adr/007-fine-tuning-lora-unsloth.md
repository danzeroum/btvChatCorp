# ADR-007 — Fine-tuning: LoRA incremental + Unsloth

**Status:** Aceito  
**Data:** 2026-03

## Contexto

Cada workspace precisa especializar o LLM no seu domínio de negócio sem treinar o modelo base completo (custo e tempo proibitivos). O sistema precisa aprender continuamente com feedbacks de usuários e novos documentos.

## Decisão

- **LoRA** (Low-Rank Adaptation) ao invés de full fine-tuning
- **Unsloth** como framework de treino (2x mais rápido que HuggingFace puro, 60% menos VRAM)
- **Treino incremental**: merge do LoRA anterior antes de treinar o novo — evita catastrophic forgetting
- **Ciclo semanal** via cron (todo domingo 3h) para workspaces com `auto_training = true`
- **3 fontes de dados** por ordem de qualidade: correções manuais (peso 2x) > aprovações > QA sintéticos
- **Threshold de deploy**: acurácia ≥ 70% no benchmark fixo do workspace, sem regressão > 5%

## Justificativa do incremental

```
LoRA v1 → merge_and_unload() → modelo fundido → novo LoRA v2
```
Sem o merge, cada versão esquece o que aprendeu anteriormente (catastrophic forgetting). Com o merge, o conhecimento acumula.

## Consequências

**Positivas:**
- Especialização por workspace sem custo de treino completo
- Zero downtime no deploy via vLLM hot-swap
- Rollback automático se acurácia regredir

**Negativas / Trade-offs:**
- LoRAs acumulam tamanho a cada merge — necessário re-distilação periódica a cada ~10 ciclos
- Benchmark fixo pode não capturar regressões em queries fora do domínio testado
