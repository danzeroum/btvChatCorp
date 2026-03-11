# ADR-006 — Embedding: Nomic Embed V2 MoE (768 dimensões)

**Status:** Aceito  
**Data:** 2026-03

## Contexto

O modelo de embedding precisa ser open-source (on-premise), ter boa performance em português, e ser eficiente o suficiente para indexar documentos em tempo real sem uma GPU dedicada de grande porte.

## Decisão

Usar **nomic-ai/nomic-embed-text-v2-moe** (768 dimensões, Mixture-of-Experts).

Alternativas avaliadas:

| Modelo | Descartado por |
|--------|---------------|
| text-embedding-3-large (OpenAI) | Cloud-only, dados saem do ambiente |
| BGE-M3 | Performance ligeiramente inferior em PT-BR nos testes internos |
| E5-large | Sem prefixos de instrução query/document |
| mxbai-embed-large | Menor suporte da comunidade |

**Detalhe crítico — prefixos de instrução:**
```
query:    "search_query: <texto>"
document: "search_document: <texto>"
```
O Nomic V2 foi treinado para diferenciar os dois modos, o que melhora o recall RAG em ~8% nos benchmarks internos.

## Consequências

**Positivas:**
- Modelo open-source, 100% on-premise
- Boa performance em PT-BR (testado em documentos corporativos)
- Roda em 1x GPU A10 (24GB) sem saturar

**Negativas / Trade-offs:**
- 768 dimensões vs. 1536 (OpenAI) — cobertura semântica ligeiramente menor em domínios muito especializados
- Requer atenção aos prefixos query/document — bug silencioso se omitidos
