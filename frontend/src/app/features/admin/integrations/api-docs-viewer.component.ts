import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ApiKey } from '../../../core/models/api-public.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-api-docs-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="api-docs">
      <div class="page-header">
        <h1>&#128196; Documenta\xE7\xE3o da API</h1>
        <div class="header-actions">
          <select [(ngModel)]="selectedVersion">
            <option value="v1">API v1 (atual)</option>
          </select>
          <button class="btn-secondary" (click)="downloadSpec()">&#11015;&#65039; Download OpenAPI JSON</button>
        </div>
      </div>

      <!-- Swagger embutido -->
      <div class="swagger-container">
        <iframe [src]="swaggerUrl" class="swagger-iframe" frameBorder="0"></iframe>
      </div>

      <!-- Playground r\xE1pido -->
      <div class="quick-playground">
        <h2>&#9654;&#65039; Teste R\xE1pido</h2>
        <p>Teste endpoints diretamente no navegador.</p>

        <div class="playground-form">
          <div class="form-row">
            <select [(ngModel)]="playground.method" class="method-select" [class]="'method-' + playground.method">
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <input [(ngModel)]="playground.path" placeholder="/api/v1/chat/completions" class="path-input" />
            <button class="btn-primary" (click)="execute()" [disabled]="executing()">Executar</button>
          </div>

          <div class="form-group">
            <label>API Key
              <select [(ngModel)]="playground.apiKeyId">
                <option value="">Selecione uma key...</option>
                @for (key of apiKeys(); track key.id) {
                  <option [value]="key.id">{{ key.name }} ({{ key.keyPrefix }}...)</option>
                }
              </select>
            </label>
          </div>

          @if (playground.method === 'POST' || playground.method === 'PUT') {
            <div class="form-group">
              <label>Request Body (JSON)
                <textarea [(ngModel)]="playground.body" rows="10" class="code-editor"></textarea>
              </label>
            </div>
          }

          @if (playground.response) {
            <div class="response-section">
              <div class="response-header">
                <span class="response-status"
                  [class.success]="playground.response.status < 400"
                  [class.error]="playground.response.status >= 400">
                  HTTP {{ playground.response.status }}
                </span>
                <span class="response-time">{{ playground.response.timeMs }}ms</span>
              </div>
              <pre class="response-body">{{ playground.response.body | json }}</pre>
            </div>
          }
        </div>
      </div>

      <!-- Exemplos de c\xF3digo -->
      <div class="code-examples">
        <h2>&#128101; Exemplos de Integra\xE7\xE3o</h2>
        <div class="example-tabs">
          @for (tab of codeTabs; track tab.id) {
            <button [class.active]="codeTab() === tab.id" (click)="codeTab.set(tab.id)">{{ tab.label }}</button>
          }
        </div>
        <pre class="code-block"><code>{{ currentExample() }}</code></pre>
      </div>

      <!-- Guia de verifica\xE7\xE3o de webhook -->
      <div class="webhook-verification-guide">
        <h2>&#128274; Verifica\xE7\xE3o de Webhooks</h2>
        <p>Sempre verifique a assinatura HMAC-SHA256 dos webhooks recebidos.</p>
        <div class="example-tabs">
          @for (tab of verifyTabs; track tab.id) {
            <button [class.active]="verifyTab() === tab.id" (click)="verifyTab.set(tab.id)">{{ tab.label }}</button>
          }
        </div>
        <pre class="code-block"><code>{{ currentVerifyExample() }}</code></pre>
      </div>
    </div>
  `
})
export class ApiDocsViewerComponent implements OnInit {
  private http      = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  selectedVersion = 'v1';
  codeTab  = signal('curl');
  verifyTab = signal('python');
  executing = signal(false);
  apiKeys  = signal<ApiKey[]>([]);

  swaggerUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl('/api/docs');

  playground = {
    method: 'POST',
    path: '/api/v1/chat/completions',
    apiKeyId: '',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Quais os riscos do contrato ABC?' }],
      project_id: 'proj-xxx',
      include_sources: true,
    }, null, 2),
    response: null as any,
  };

  codeTabs = [
    { id: 'curl',   label: 'cURL' },
    { id: 'python', label: 'Python' },
    { id: 'node',   label: 'Node.js' },
    { id: 'rust',   label: 'Rust' },
  ];

  verifyTabs = [
    { id: 'python', label: 'Python' },
    { id: 'node',   label: 'Node.js' },
  ];

  private examples: Record<string, string> = {
    curl: `curl -X POST ${environment.apiUrl}/api/v1/chat/completions \\\n  -H "Authorization: Bearer sk-live-xxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "messages": [{"role": "user", "content": "Resuma o contrato ABC"}], "project_id": "proj-xxx" }'`,
    python: `import requests\n\nAPI_KEY = "sk-live-xxx"\nBASE_URL = "${environment.apiUrl}/api/v1"\n\nresponse = requests.post(\n    f"{BASE_URL}/chat/completions",\n    headers={"Authorization": f"Bearer {API_KEY}"},\n    json={\n        "messages": [{"role": "user", "content": "Resuma o contrato"}],\n        "project_id": "proj-xxx",\n        "include_sources": True\n    }\n)\ndata = response.json()\nprint(data["choices"][0]["message"]["content"])`,
    node: `const API_KEY = "sk-live-xxx";\nconst BASE_URL = "${environment.apiUrl}/api/v1";\n\nconst response = await fetch(\`\${BASE_URL}/chat/completions\`, {\n  method: "POST",\n  headers: {\n    "Authorization": \`Bearer \${API_KEY}\`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    messages: [{ role: "user", content: "Resuma o contrato ABC" }],\n    project_id: "proj-xxx",\n    include_sources: true\n  })\n});\n\nconst data = await response.json();\nconsole.log(data.choices[0].message.content);`,
    rust: `let client = reqwest::Client::new();\nlet res = client\n    .post("${environment.apiUrl}/api/v1/chat/completions")\n    .header("Authorization", "Bearer sk-live-xxx")\n    .json(&serde_json::json!({\n        "messages": [{"role": "user", "content": "Resuma o contrato"}],\n        "project_id": "proj-xxx"\n    }))\n    .send().await?;`,
  };

  private verifyExamples: Record<string, string> = {
    python: `import hmac, hashlib\n\ndef verify_webhook(payload_body: bytes, signature: str, secret: str) -> bool:\n    expected = hmac.new(secret.encode(), payload_body, hashlib.sha256).hexdigest()\n    received = signature.replace("sha256=", "")\n    return hmac.compare_digest(expected, received)\n\n# Flask/FastAPI\n@app.post("/webhook")\nasync def handle_webhook(request: Request):\n    body = await request.body()\n    sig  = request.headers.get("X-Webhook-Signature", "")\n    if not verify_webhook(body, sig, WEBHOOK_SECRET):\n        raise HTTPException(status_code=401, detail="Invalid signature")\n    event = await request.json()\n    print(f"Evento: {event['type']}")\n    return {"status": "ok"}`,
    node: `const crypto = require("crypto");\n\nfunction verifyWebhook(payload, signature, secret) {\n  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");\n  const received = signature.replace("sha256=", "");\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));\n}\n\n// Express.js\napp.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {\n  const sig = req.headers["x-webhook-signature"];\n  if (!verifyWebhook(req.body, sig, WEBHOOK_SECRET)) {\n    return res.status(401).send("Invalid signature");\n  }\n  const event = JSON.parse(req.body);\n  console.log("Evento:", event.type);\n  res.json({ status: "ok" });\n});`,
  };

  ngOnInit(): void {
    this.http.get<ApiKey[]>('/api/admin/api-keys').subscribe((keys) => this.apiKeys.set(keys));
  }

  currentExample = () => this.examples[this.codeTab()] ?? '';
  currentVerifyExample = () => this.verifyExamples[this.verifyTab()] ?? '';

  execute(): void {
    this.executing.set(true);
    const start = Date.now();
    const key = this.apiKeys().find((k) => k.id === this.playground.apiKeyId);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key.keyPrefix}...`;

    let body: any = undefined;
    try { body = JSON.parse(this.playground.body); } catch { body = this.playground.body; }

    this.http.request(this.playground.method, this.playground.path, { body, headers, observe: 'response' }).subscribe({
      next: (res: any) => {
        this.playground.response = { status: res.status, body: res.body, timeMs: Date.now() - start };
        this.executing.set(false);
      },
      error: (err: any) => {
        this.playground.response = { status: err.status ?? 0, body: err.error, timeMs: Date.now() - start };
        this.executing.set(false);
      },
    });
  }

  downloadSpec(): void {
    window.open('/api/docs/openapi.json', '_blank');
  }
}
