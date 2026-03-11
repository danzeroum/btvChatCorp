# ADR-009 — Armazenamento de Documentos: PostgreSQL + Volume Local

**Status:** Aceito  
**Data:** 2026-03

## Contexto

O sistema precisa armazenar arquivos corporativos (PDF, DOCX, XLSX) enviados pelos workspaces, com controle de acesso por tenant e rastreabilidade completa (quem enviou, quando, status de processamento).

## Decisão

- **Metadados** no PostgreSQL (tabela `documents`): nome, tamanho, tipo, status, workspace_id, uploader
- **Arquivo físico** em volume Docker local (`/uploads/{workspace_id}/{uuid}.{ext}`)
- **Sem S3/MinIO** na versão inicial — complexidade desnecessária para deployment on-premise

A tabela `documents` e o arquivo físico são a fonte da verdade. Os chunks em Qdrant são derivados e reconstruíveis a partir do arquivo original.

## Justificativa

A maioria dos deployments on-premise tem acesso a storage local de alta capacidade. S3/MinIO adiciona um serviço extra sem benefício claro na fase atual. A migração para S3-compatible é possível alterando apenas `document_processor.py`.

## Consequências

**Positivas:**
- Simplicidade operacional — sem serviço de object storage extra
- Backup simples: `pg_dump` + cópia do volume `/uploads`

**Negativas / Trade-offs:**
- Não escala horizontalmente (múltiplos nós de API precisam de NFS ou migração para S3)
- Sem versionamento de arquivo — substituição apaga a versão anterior
