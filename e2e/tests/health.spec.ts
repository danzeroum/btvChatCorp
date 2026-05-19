import { test, expect } from '@playwright/test';

test.describe('Health checks', () => {
  test('GET /health retorna status ok', async ({ request }) => {
    const resp = await request.get('/health');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('ok');
  });

  test('GET / retorna a SPA Angular (status 200)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });
});
