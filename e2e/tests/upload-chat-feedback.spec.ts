import { test, expect, APIRequestContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Helper: autentica e retorna token
async function authenticate(request: APIRequestContext): Promise<string> {
  const resp = await request.post('/api/v1/auth/login', {
    data: {
      email:    process.env.E2E_USER_EMAIL    || 'admin@btvc.com',
      password: process.env.E2E_USER_PASSWORD || 'BTV_E2E_Test!',
    },
  });
  const body = await resp.json();
  return body.access_token as string;
}

test.describe('Fluxo principal: Upload → Chat → Feedback', () => {
  let token: string;
  let documentId: string;
  let chatId: string;

  test.beforeAll(async ({ request }) => {
    token = await authenticate(request);
  });

  // ---- T2.1: Upload de documento ----
  test('T2.1 — upload de PDF retorna document_id', async ({ request }) => {
    // Cria um arquivo de texto simples para o teste (sem PDF binário)
    const tempPath = path.join(__dirname, 'fixture.txt');
    fs.writeFileSync(tempPath, 'Conteúdo de teste BTV Chat Corp E2E');

    const resp = await request.post('/api/v1/documents', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'fixture.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Conteúdo de teste BTV Chat Corp E2E'),
        },
      },
    });

    fs.unlinkSync(tempPath);
    expect([200, 201]).toContain(resp.status());
    const body = await resp.json();
    expect(body).toHaveProperty('id');
    documentId = body.id;
  });

  // ---- T2.2: Chat com contexto do documento ----
  test('T2.2 — chat com documento retorna resposta não vazia', async ({ request }) => {
    test.skip(!documentId, 'Skipping: upload anterior falhou');

    const resp = await request.post('/api/v1/chat', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        message:     'O que este documento contém?',
        document_id: documentId,
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('response');
    expect(typeof body.response).toBe('string');
    expect(body.response.length).toBeGreaterThan(5);
    chatId = body.chat_id || body.id;
  });

  // ---- T2.3: Feedback ----
  test('T2.3 — envio de feedback positivo retorna 200', async ({ request }) => {
    test.skip(!chatId, 'Skipping: chat anterior falhou');

    const resp = await request.post('/api/v1/feedback', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        chat_id:  chatId,
        rating:   5,
        comment:  'Resposta correta e relevante',
      },
    });
    expect([200, 201]).toContain(resp.status());
  });
});
