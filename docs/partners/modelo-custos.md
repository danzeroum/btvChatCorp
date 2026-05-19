# Modelo de Custos BTV — Referencia Interna

> Documento interno para definicao de precos e estrutura de faturamento.
> Nao compartilhar com clientes sem autorizacao da lideranca.

---

## Estrutura de Custos de Infraestrutura (por workspace/mes)

| Componente | Custo Estimado | Base de Calculo |
|------------|---------------|----------------|
| PostgreSQL (RDS t3.medium) | R$ 180 | 1 instancia compartilhada (ate 20 workspaces) |
| Qdrant (c5.xlarge) | R$ 320 | 1 instancia, ~5GB embeddings por workspace |
| vLLM + LoRA (g4dn.xlarge GPU) | R$ 1.200 | 1 GPU compartilhada, ~10 workspaces concurrent |
| Nomic Embeddings (CPU) | R$ 80 | t3.large compartilhado |
| Redis (ElastiCache) | R$ 60 | cache de sessoes e rate limit |
| nginx + BTV Gateway | R$ 40 | t3.small |
| Armazenamento S3 (docs PDF) | R$ 0,12/GB | media 2GB/workspace/mes |
| Transferencia de dados | R$ 0,05/GB | saida estimada 5GB/workspace/mes |
| **Total infra por workspace** | **~R$ 90-150/mes** | varia com uso |

*Base: AWS sa-east-1 (Sao Paulo), novembro 2025*

---

## Modelo de Precos para Parceiros

### Plano Starter
- **Preco parceiro:** R$ 497/mes
- **Workspaces inclusos:** 5
- **Custo infra estimado:** 5 x R$ 120 = R$ 600
- **Margem bruta:** negativa sem escala
- **Objetivo:** aquisicao e onboarding. Lucrativo a partir de 4+ workspaces ativos.

### Plano Growth
- **Preco parceiro:** R$ 1.497/mes
- **Workspaces inclusos:** 20
- **Custo infra estimado:** 20 x R$ 90 = R$ 1.800 (economia de escala)
- **Margem bruta:** ~17% com escala plena
- **Objetivo:** parceiros com carteira de clientes ativa.

### Plano Enterprise
- **Preco parceiro:** negociado (baseline: R$ 5.000+/mes)
- **Workspaces:** ilimitados dentro do contrato
- **Custo infra:** instancias dedicadas (isolamento total)
- **Margem bruta alvo:** 40-60%
- **Objetivo:** grandes integradores e revendedores nacionais.

---

## Modelo de Faturamento por Uso (Add-ons)

| Item | Preco | Incluso nos planos? |
|------|-------|--------------------|
| Mensagens extras (alem do pacote) | R$ 0,05/mensagem | Nao |
| Documentos extras (alem de 100/workspace) | R$ 0,10/doc | Nao |
| Fine-tuning manual (ciclo extra) | R$ 50/ciclo | Nao |
| Dominio customizado (CNAME proprio) | R$ 30/mes/workspace | Nao |
| SLA prioritario (2h) | R$ 200/mes | Apenas Enterprise |

---

## Break-even por Plano

| Plano | Break-even (workspaces ativos) | CAC maximo sugerido |
|-------|-------------------------------|--------------------|
| Starter | 6 workspaces (R$ 2.982 receita) | R$ 300 |
| Growth | 15 workspaces | R$ 800 |
| Enterprise | 1 contrato (pelo volume) | R$ 5.000 |

---

## Projecao de Receita (Ano 1)

| Cenario | Parceiros | Workspaces Medios | MRR | ARR |
|---------|-----------|------------------|-----|-----|
| Conservador | 5 Growth | 10 WS cada | R$ 7.485 | R$ 89.820 |
| Moderado | 10 Growth + 2 Enterprise | 15 WS medio | R$ 24.970 | R$ 299.640 |
| Otimista | 30 Growth + 5 Enterprise | 20 WS medio | R$ 69.910 | R$ 838.920 |

---

## Politica de Chargeback e Cancelamento

- Faturamento mensal, pagamento antecipado via boleto ou cartao
- Cancelamento: aviso com 30 dias de antecedencia
- Dados retidos por 90 dias apos cancelamento
- Sem reembolso proporcional (exceto falha de SLA documentada)
