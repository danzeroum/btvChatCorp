# ADR-003 — Backend: FastAPI → Rust/Axum

**Status:** SUPERSEDED por ADR-011  
**Data:** 2025-10-01  
**Revisado em:** 2026-05-19

## Contexto

O backend inicial foi prototipado em FastAPI (Python) para validar os fluxos de
autenticação, RAG e administração rapidamente. Com o crescimento do projeto e os
requisitos de performance para inferência e processamento de documentos, avaliou-se
substituir o runtime.

## Decisão

Manter FastAPI como backend principal para a fase de prototipagem (Sprint 0).

## Consequências

- ✅ Iteração rápida no início do projeto
- ✅ Ecossistema Python para ML/AI (PyTorch, transformers)
- ❌ Performance inadequada para workloads de produção (RAG + streaming)
- ❌ Tipagem dinâmica gerou bugs sutis em produção

## Supersedido

Esta decisão foi **supersedida pela ADR-011** em 2026-05-19.  
O backend foi migrado integralmente para Rust/Axum. Ver [ADR-011](./011-migracao-rust-axum.md).
