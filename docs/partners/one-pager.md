# btvChatCorp — One-Pager de Produto

**Plataforma de Chat com IA para Empresas Brasileiras**

---

## O Problema

Empresas brasileiras querem usar IA generativa nos seus processos internos,
mas enfrentam tres barreiras: custo de desenvolvimento, risco LGPD com dados
na nuvem americana, e falta de personalizacao para o negocio especifico.

## A Solucao

O btvChatCorp e uma plataforma white-label de chatbot com IA que:

- **Roda no Brasil** — dados nunca saem do pais (AWS sa-east-1)
- **Aprende com seus documentos** — RAG sobre PDFs, DOCX, base de conhecimento
- **Melhora automaticamente** — fine-tuning continuo com LoRA baseado em feedback
- **E sua marca** — subdominio, logo, cores, zero mencao ao BTV
- **API OpenAI-compatible** — qualquer dev ja sabe usar

## Diferenciais Competitivos

| Feature | btvChatCorp | ChatGPT Enterprise | AWS Bedrock |
|---------|------------|-------------------|-----------|
| Dados 100% no Brasil | ✓ | ✗ | Parcial |
| White-label | ✓ | ✗ | ✗ |
| Fine-tuning continuo | ✓ | ✗ | Configuravel |
| Preco em BRL | ✓ | ✗ | ✗ |
| Multi-tenant parceiros | ✓ | ✗ | ✗ |

## Tecnologia

- Backend: Rust/Axum (alta performance, seguranca de memoria)
- LLM: Llama 3 8B com adapters LoRA por workspace
- RAG: Qdrant (vector search) + Nomic embeddings
- Frontend: Angular 18
- Infra: Docker Compose / Kubernetes-ready

## Traction

- v0.1.0 lancada (Maio 2026)
- Pipeline RAG + fine-tuning funcionais
- API OpenAI-compatible ativa
- Programa de parceiros aberto

## Contato

BuiltToValue — buildtovalue.cloud
Email: parceiros@btvc.com
