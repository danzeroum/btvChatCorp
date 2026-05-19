# BTV Gateway

Proxy inteligente OpenAI-compatible que adiciona RAG e fine-tuning ao seu LLM.

## Visao Geral

O BTV Gateway e um servidor HTTP independente que expoe uma API compativel com
a OpenAI, permitindo que qualquer cliente que ja usa a SDK da OpenAI se conecte
ao btvChatCorp sem alterar uma linha de codigo.

```
Cliente (SDK OpenAI)
       |
       v
 BTV Gateway :4000   <-- autenticacao por API key
       |
       +---> RAG (Qdrant)       <-- contexto dos documentos
       +---> LLM (vLLM/Ollama)  <-- inferencia
       +---> Fine-tune (LoRA)   <-- personalizacao continua
```

## Endpoints

| Metodo | Rota | Descricao |
|--------|------|----------|
| `POST` | `/v1/chat/completions` | Inferencia (OpenAI-compatible) |
| `POST` | `/v1/embeddings` | Vetorizacao (OpenAI-compatible) |
| `GET`  | `/v1/models` | Lista modelos disponiveis |
| `GET`  | `/health` | Healthcheck |
| `GET`  | `/docs` | Swagger UI |

## Autenticacao

Todas as rotas (exceto `/health` e `/docs`) requerem:
```
Authorization: Bearer btv_<sua_api_key>
```

Gere uma API key no painel admin: **Admin > API Keys > Nova Key**.

## Exemplos de Uso

### Python (OpenAI SDK)
```python
from openai import OpenAI

client = OpenAI(
    api_key="btv_sua_chave_aqui",
    base_url="https://api.btvc.com/v1"
)

response = client.chat.completions.create(
    model="btv-llama3-8b",
    messages=[{"role": "user", "content": "O que diz o contrato de servico?"}]
)
print(response.choices[0].message.content)
```

### Node.js (OpenAI SDK)
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'btv_sua_chave_aqui',
  baseURL: 'https://api.btvc.com/v1'
});

const completion = await client.chat.completions.create({
  model: 'btv-llama3-8b',
  messages: [{ role: 'user', content: 'Resuma os documentos de RH.' }]
});
console.log(completion.choices[0].message.content);
```

### cURL
```bash
curl https://api.btvc.com/v1/chat/completions \
  -H "Authorization: Bearer btv_sua_chave" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "btv-llama3-8b",
    "messages": [{"role": "user", "content": "Qual a politica de ferias?"}]
  }'
```

## Rate Limiting

- Default: **60 requests/minuto** por API key
- Configuravel via `GATEWAY_RATE_LIMIT_RPM`
- HTTP 429 com header `Retry-After` em segundos

## Variaveis de Ambiente

| Variavel | Default | Descricao |
|----------|---------|----------|
| `GATEWAY_BIND_ADDR` | `0.0.0.0:4000` | Endereco de bind |
| `INTERNAL_API_URL` | `http://api:3000` | URL da API interna |
| `DATABASE_URL` | — | PostgreSQL (obrigatorio) |
| `GATEWAY_RATE_LIMIT_RPM` | `60` | Requests/min por key |
