# Programa de Parceiros BTV

## Visao Geral

O Programa de Parceiros BTV permite que consultorias, agencias digitais e
revenderores oferencam aos seus clientes um chatbot de IA com marca propria
(white-label), sem precisar construir a infraestrutura de IA do zero.

**Narrativa de marketing:** *"Tenha seu proprio chatbot de IA com a cara da
sua empresa em 24 horas, sem desenvolvimento."*

---

## Modelos de Parceria

| Plano | Workspaces | Mensagens/mes | Preco Parceiro | Preco Sugerido Cliente |
|-------|-----------|--------------|---------------|----------------------|
| **Starter** | ate 5 | 10.000 | R$ 497/mes | R$ 997-1.497/mes |
| **Growth** | ate 20 | 50.000 | R$ 1.497/mes | R$ 4.000-6.000/mes |
| **Enterprise** | ilimitado | personalizado | consultar | consultar |

Margem sugerida: **50-200%** sobre o preco de parceiro.

---

## Como Funciona o White-Label

### 1. Subdominio customizado
Cada workspace recebe um subdominio `cliente.btvc.com` ou pode usar dominio
proprio via CNAME:
```
chat.suaempresa.com  CNAME  suaempresa.btvc.com
```

### 2. Branding dinamico
O crate `branding` gera CSS personalizado em runtime:
- Logo (URL ou upload)
- Cor primaria (`#RRGGBB`)
- Nome da empresa
- Favicon

### 3. Onboarding do cliente final (< 10 minutos)
1. Parceiro cria workspace via API ou portal
2. BTV provisiona subdominio + SSL automaticamente
3. Cliente acessa o chat e faz upload dos documentos
4. RAG ativo em < 5 minutos apos o upload

---

## API do Programa de Parceiros

### Criar conta de parceiro
```bash
curl -X POST https://app.btvc.com/partner/signup \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Consultoria XPTO",
    "email": "tech@xpto.com.br",
    "password": "senhaSegura123!",
    "cnpj": "12345678000195",
    "plan": "starter"
  }'
```

Resposta:
```json
{
  "partner_id": "uuid",
  "api_key": "btv_abc123...",
  "message": "Parceiro criado com sucesso. Guarde sua API key."
}
```

### Criar workspace para cliente
```bash
curl -X POST https://app.btvc.com/partner/workspaces \
  -H "Authorization: Bearer btv_sua_chave" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Empresa ABC",
    "subdomain": "abc",
    "primary_color": "#1a56db",
    "logo_url": "https://abc.com.br/logo.png"
  }'
```

---

## SLA e Suporte

| Nivel | Tempo de Resposta | Canal |
|-------|------------------|-------|
| Critico (producao down) | 2 horas | WhatsApp dedicado |
| Alto (feature indisponivel) | 8 horas | Email + ticket |
| Normal (duvidas, melhorias) | 2 dias uteis | Portal de suporte |

---

## Compliance e LGPD

- Dados dos clientes finais ficam **isolados por workspace** (multi-tenant)
- Cada workspace tem sua propria colecao no Qdrant
- Parceiros **nao acessam dados** de outros parceiros ou clientes
- DPA (Data Processing Agreement) disponivel para clientes enterprise
- Dados processados em infraestrutura **100% no Brasil** (AWS sa-east-1)
