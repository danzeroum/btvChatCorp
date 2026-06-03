# Política de Segurança

## Reportar uma vulnerabilidade

Se você encontrar uma vulnerabilidade de segurança neste projeto, por favor
**não abra uma issue pública**. Em vez disso, entre em contato de forma privada
pelo e-mail: **danniellau@gmail.com**.

Inclua, se possível:
- Descrição da vulnerabilidade e impacto potencial
- Passos para reproduzir
- Versão/commit afetado

Faremos o possível para responder em tempo hábil.

## Gestão de segredos

- **Nunca** faça commit de segredos reais (chaves de API, senhas, tokens, chaves
  privadas) no repositório.
- Use `.env` localmente — ele está no `.gitignore` e no `.dockerignore` e **não**
  deve ser versionado. Use `.env.example` como template (todos os valores são
  placeholders `TROQUE_AQUI`).
- O CI executa [gitleaks](https://github.com/gitleaks/gitleaks) em cada PR para
  detectar segredos acidentalmente commitados (config em `.gitleaks.toml`).
- Segredos obrigatórios (`JWT_SECRET`, `API_KEY_HMAC_SECRET`,
  `INTERNAL_SERVICE_TOKEN`) têm *fail-fast*: a aplicação não sobe sem eles.
- Certificados TLS devem ser provisionados externamente (ex.: Let's Encrypt/certbot)
  e **nunca** versionados.
