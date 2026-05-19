import { test, expect } from '@playwright/test';

test.describe('Auth — Login e Refresh', () => {
  test('login com credenciais válidas retorna access token', async ({ request }) => {
    const resp = await request.post('/api/v1/auth/login', {
      data: {
        email:    process.env.E2E_USER_EMAIL    || 'admin@btvc.com',
        password: process.env.E2E_USER_PASSWORD || 'BTV_E2E_Test!',
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('access_token');
    expect(body).toHaveProperty('refresh_token');
  });

  test('login com credenciais inválidas retorna 401', async ({ request }) => {
    const resp = await request.post('/api/v1/auth/login', {
      data: { email: 'nao@existe.com', password: 'errada' },
    });
    expect(resp.status()).toBe(401);
  });

  test('rota protegida sem token retorna 401', async ({ request }) => {
    const resp = await request.get('/api/v1/auth/me');
    expect(resp.status()).toBe(401);
  });
});
