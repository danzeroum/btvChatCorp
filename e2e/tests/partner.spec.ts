import { test, expect } from '@playwright/test';

test.describe('Partner — Signup e Workspaces', () => {
  const partnerEmail = `e2e-partner-${Date.now()}@btvc-test.com`;
  let authToken: string;

  test('signup de parceiro cria conta e retorna token', async ({ request }) => {
    const resp = await request.post('/api/v1/partner/signup', {
      data: {
        name:         'Parceiro E2E Teste',
        email:        partnerEmail,
        password:     'PartnerE2E!2026',
        company_name: 'Empresa Teste Ltda',
        plan:         'starter',
      },
    });
    expect([200, 201]).toContain(resp.status());
    const body = await resp.json();
    expect(body).toHaveProperty('access_token');
    authToken = body.access_token;
  });

  test('parceiro autenticado cria workspace white-label', async ({ request }) => {
    test.skip(!authToken, 'Skipping: signup anterior falhou');

    const resp = await request.post('/api/v1/partner/workspaces', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        name:       'Workspace E2E',
        slug:       `e2e-ws-${Date.now()}`,
        brand_name: 'Marca Teste',
      },
    });
    expect([200, 201]).toContain(resp.status());
    const body = await resp.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('slug');
  });

  test('listar workspaces retorna array', async ({ request }) => {
    test.skip(!authToken, 'Skipping: signup anterior falhou');

    const resp = await request.get('/api/v1/partner/workspaces', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.data || body)).toBe(true);
  });

  test('BTV Gateway: /v1/chat/completions sem API key retorna 401', async ({ request }) => {
    const resp = await request.post('/v1/chat/completions', {
      data: {
        model:    'btv-default',
        messages: [{ role: 'user', content: 'Oi' }],
      },
    });
    expect(resp.status()).toBe(401);
  });
});
