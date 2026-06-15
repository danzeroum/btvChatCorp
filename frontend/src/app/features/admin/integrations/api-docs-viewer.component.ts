import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  tag: string;
  requestBody?: object;
  responseExample?: object;
  requiresAuth: boolean;
  scopes: string[];
}

@Component({
  selector: 'app-api-docs-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="api-docs">
      <div class="page-header">
        <div>
          <h1>&#128196; Documentação da API</h1>
          <p>Referência completa dos endpoints REST da plataforma.</p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" (click)="downloadSpec()">&#11015;&#65039; OpenAPI JSON</button>
          <a class="btn-secondary" href="/api/swagger-ui" target="_blank">&#127760; Abrir Swagger UI</a>
        </div>
      </div>

      <!-- Info geral -->
      <div class="api-info-card">
        <div class="info-item">
          <span class="info-label">Base URL</span>
          <code>{{ baseUrl }}</code>
        </div>
        <div class="info-item">
          <span class="info-label">Autenticação</span>
          <code>Authorization: Bearer &lt;api_key&gt;</code>
        </div>
        <div class="info-item">
          <span class="info-label">Versão</span>
          <code>v1</code>
        </div>
        <div class="info-item">
          <span class="info-label">Rate limit padrão</span>
          <code>60 req/min por API key</code>
        </div>
      </div>

      <div class="docs-layout">
        <!-- Sidebar de navegação -->
        <nav class="docs-nav">
          <input [(ngModel)]="searchQuery" placeholder="Buscar endpoints..." class="docs-search" />
          @for (tag of visibleTags(); track tag) {
            <div class="nav-group">
              <div class="nav-group-title" (click)="toggleTag(tag)">
                <span>{{ tag }}</span>
                <span>{{ expandedTags().includes(tag) ? '▾' : '▸' }}</span>
              </div>
              @if (expandedTags().includes(tag)) {
                @for (ep of endpointsByTag(tag); track ep.path + ep.method) {
                  <button class="nav-endpoint" [class.active]="selectedEndpoint()?.path === ep.path && selectedEndpoint()?.method === ep.method"
                    (click)="selectEndpoint(ep)">
                    <span class="method-badge" [class]="ep.method.toLowerCase()">{{ ep.method }}</span>
                    <span>{{ ep.path }}</span>
                  </button>
                }
              }
            </div>
          }
        </nav>

        <!-- Detalhe do endpoint -->
        <div class="docs-content">
          @if (!selectedEndpoint()) {
            <div class="docs-welcome">
              <h2>Selecione um endpoint na barra lateral</h2>
              <p>{{ endpoints().length }} endpoints disponíveis em {{ allTags().length }} categorias.</p>
              <div class="quick-stats">
                @for (tag of allTags(); track tag) {
                  <div class="quick-stat">
                    <span class="stat-count mono">{{ endpointsByTag(tag).length }}</span>
                    <span class="stat-tag">{{ tag }}</span>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="endpoint-detail">
              <div class="endpoint-title">
                <span class="method-badge lg" [class]="selectedEndpoint()!.method.toLowerCase()">{{ selectedEndpoint()!.method }}</span>
                <code class="endpoint-path">{{ selectedEndpoint()!.path }}</code>
                @if (!selectedEndpoint()!.requiresAuth) {
                  <span class="public-badge">público</span>
                }
              </div>

              <h2>{{ selectedEndpoint()!.summary }}</h2>
              <p>{{ selectedEndpoint()!.description }}</p>

              @if (selectedEndpoint()!.scopes.length > 0) {
                <div class="scopes-section">
                  <h4>Permissões necessárias</h4>
                  <div class="scope-chips">
                    @for (scope of selectedEndpoint()!.scopes; track scope) {
                      <span class="scope-chip">{{ scope }}</span>
                    }
                  </div>
                </div>
              }

              @if (selectedEndpoint()!.requestBody) {
                <div class="code-section">
                  <h4>Request Body</h4>
                  <pre><code>{{ selectedEndpoint()!.requestBody | json }}</code></pre>
                </div>
              }

              @if (selectedEndpoint()!.responseExample) {
                <div class="code-section">
                  <h4>Exemplo de Resposta</h4>
                  <pre><code>{{ selectedEndpoint()!.responseExample | json }}</code></pre>
                </div>
              }

              <!-- Try it out -->
              <div class="try-it-section">
                <h4>&#128640; Try it out</h4>
                <div class="try-it-form">
                  <div class="try-it-url">
                    <span class="method-badge" [class]="selectedEndpoint()!.method.toLowerCase()">{{ selectedEndpoint()!.method }}</span>
                    <input [(ngModel)]="tryItUrl" class="url-input" />
                  </div>
                  <div class="try-it-auth">
                    <input [(ngModel)]="tryItApiKey" placeholder="API Key para teste" class="apikey-input" />
                  </div>
                  @if (['POST','PUT','PATCH'].includes(selectedEndpoint()!.method)) {
                    <textarea [(ngModel)]="tryItBody" rows="6" placeholder="Request body (JSON)"></textarea>
                  }
                  <button class="btn-primary" (click)="executeRequest()" [disabled]="executing()">
                    {{ executing() ? 'Executando...' : '&#9654;&#65039; Executar' }}
                  </button>
                </div>
                @if (tryItResponse()) {
                  <div class="try-it-response" [class.success]="tryItStatus() < 300" [class.error]="tryItStatus() >= 400">
                    <div class="response-status mono">HTTP {{ tryItStatus() }}</div>
                    <pre><code>{{ tryItResponse() }}</code></pre>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
    .api-docs { padding: 28px 32px; background: var(--panel-2); min-height: 100vh; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header h1 { font-size:22px; font-weight:700; color: var(--ink); margin:0 0 4px; }
    .page-header p { font-size:13px; color: var(--ink-2); margin:0; }
    .header-actions { display:flex; gap:10px; align-items:center; }
    .btn-primary { padding:8px 18px; background: var(--acc); color: var(--white); border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; font-family:'IBM Plex Sans',system-ui,sans-serif; }
    .btn-primary:hover { opacity:0.88; }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-secondary { background: var(--panel-2); color: var(--ink); border:1px solid var(--line); border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; text-decoration:none; display:inline-flex; align-items:center; }
    .api-info-card { background: var(--white); border:1px solid var(--line); border-radius:12px; padding:16px 24px; margin-bottom:16px; display:flex; flex-wrap:wrap; gap:20px; }
    .info-item { display:flex; align-items:center; gap:8px; }
    .info-label { font-size:12px; color: var(--ink-2); font-weight:500; }
    .info-item code { font-family:'IBM Plex Mono',monospace; font-size:12px; background: var(--panel-2); border:1px solid var(--line); border-radius:4px; padding:2px 8px; color: var(--ink); }
    .docs-layout { display:flex; gap:16px; align-items:flex-start; }
    .docs-nav { width:260px; flex-shrink:0; background: var(--white); border:1px solid var(--line); border-radius:12px; padding:16px; position:sticky; top:16px; max-height:80vh; overflow-y:auto; }
    .docs-search { width:100%; background: var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:7px 10px; font-size:12px; color: var(--ink); box-sizing:border-box; margin-bottom:12px; font-family:'IBM Plex Sans',system-ui,sans-serif; }
    .docs-search:focus { outline:none; border-color: var(--acc); }
    .nav-group { margin-bottom:4px; }
    .nav-group-title { display:flex; justify-content:space-between; align-items:center; padding:6px 8px; font-size:12px; font-weight:600; color: var(--ink); cursor:pointer; border-radius:6px; }
    .nav-group-title:hover { background: var(--panel-2); }
    .nav-endpoint { display:flex; align-items:center; gap:6px; width:100%; background:none; border:none; cursor:pointer; padding:5px 8px; font-size:12px; color: var(--ink); border-radius:6px; text-align:left; font-family:'IBM Plex Sans',system-ui,sans-serif; }
    .nav-endpoint:hover { background: var(--panel-2); }
    .nav-endpoint.active { background: var(--acc-soft); color: var(--acc); }
    .docs-content { flex:1; min-width:0; }
    .docs-welcome { background: var(--white); border:1px solid var(--line); border-radius:12px; padding:40px 24px; text-align:center; }
    .docs-welcome h2 { font-size:18px; font-weight:600; color: var(--ink); margin:0 0 8px; }
    .docs-welcome p { font-size:13px; color: var(--ink-2); margin:0 0 20px; }
    .quick-stats { display:flex; flex-wrap:wrap; gap:12px; justify-content:center; }
    .quick-stat { background: var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:10px 20px; text-align:center; }
    .stat-count { font-size:20px; font-weight:700; color: var(--acc); display:block; }
    .stat-tag { font-size:11px; color: var(--ink-2); }
    .mono { font-family:'IBM Plex Mono',monospace; }
    .endpoint-detail { background: var(--white); border:1px solid var(--line); border-radius:12px; padding:24px; }
    .endpoint-title { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
    .endpoint-path { font-family:'IBM Plex Mono',monospace; font-size:14px; background: var(--panel-2); border:1px solid var(--line); border-radius:6px; padding:4px 10px; color: var(--ink); }
    .public-badge { background:#dcfce7; color:#15803d; font-size:11px; padding:2px 8px; border-radius:20px; font-weight:500; }
    .endpoint-detail h2 { font-size:16px; font-weight:600; color: var(--ink); margin:0 0 8px; }
    .endpoint-detail p { font-size:13px; color: var(--ink-2); margin:0 0 16px; }
    .method-badge { display:inline-block; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }
    .method-badge.get { background:#dbeafe; color:#1d4ed8; }
    .method-badge.post { background:#dcfce7; color:#15803d; }
    .method-badge.put { background:#fef3c7; color:#92400e; }
    .method-badge.patch { background:#fce7f3; color:#9d174d; }
    .method-badge.delete { background:#fee2e2; color:#991b1b; }
    .method-badge.lg { font-size:13px; padding:5px 12px; }
    .scopes-section, .code-section, .try-it-section { margin-top:16px; }
    .scopes-section h4, .code-section h4, .try-it-section h4 { font-size:13px; font-weight:600; color: var(--ink); margin:0 0 8px; }
    .scope-chips { display:flex; flex-wrap:wrap; gap:6px; }
    .scope-chip { background: var(--acc-soft); color: var(--acc); font-size:11px; padding:3px 10px; border-radius:20px; font-weight:500; }
    pre { background:#1e293b; color:#e2e8f0; border-radius:8px; padding:14px 16px; font-size:12px; font-family:'IBM Plex Mono',monospace; overflow:auto; margin:0; }
    pre code { font-family:'IBM Plex Mono',monospace; }
    .try-it-section { border-top:1px solid var(--line); padding-top:16px; }
    .try-it-form { display:flex; flex-direction:column; gap:10px; }
    .try-it-url, .try-it-auth { display:flex; align-items:center; gap:8px; }
    .url-input, .apikey-input { flex:1; background: var(--white); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:13px; color: var(--ink); font-family:'IBM Plex Mono',monospace; }
    .url-input:focus, .apikey-input:focus { outline:none; border-color: var(--acc); }
    .try-it-form textarea { background:#1e293b; color:#e2e8f0; border:none; border-radius:8px; padding:12px; font-size:12px; font-family:'IBM Plex Mono',monospace; resize:vertical; }
    .try-it-response { margin-top:12px; border-radius:8px; overflow:hidden; }
    .response-status { padding:6px 14px; font-size:12px; font-weight:600; }
    .try-it-response.success .response-status { background:#dcfce7; color:#15803d; }
    .try-it-response.error .response-status { background:#fee2e2; color:#991b1b; }
    .try-it-response pre { border-radius:0 0 8px 8px; }
  `]
})
export class ApiDocsViewerComponent implements OnInit {
  private http      = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  endpoints        = signal<ApiEndpoint[]>([]);
  selectedEndpoint = signal<ApiEndpoint | null>(null);
  expandedTags     = signal<string[]>([]);
  searchQuery      = '';
  executing        = signal(false);
  tryItUrl         = '';
  tryItApiKey      = '';
  tryItBody        = '';
  tryItResponse    = signal<string | null>(null);
  tryItStatus      = signal(0);

  baseUrl = window.location.origin + '/api/v1';

  allTags(): string[] {
    return [...new Set(this.endpoints().map((e) => e.tag))];
  }

  visibleTags(): string[] {
    if (!this.searchQuery) return this.allTags();
    const q = this.searchQuery.toLowerCase();
    return this.allTags().filter((tag) =>
      this.endpointsByTag(tag).some((e) => e.path.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q))
    );
  }

  endpointsByTag(tag: string): ApiEndpoint[] {
    const q = this.searchQuery.toLowerCase();
    return this.endpoints()
      .filter((e) => e.tag === tag)
      .filter((e) => !q || e.path.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q));
  }

  toggleTag(tag: string): void {
    const tags = this.expandedTags();
    this.expandedTags.set(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  }

  selectEndpoint(ep: ApiEndpoint): void {
    this.selectedEndpoint.set(ep);
    this.tryItUrl = this.baseUrl + ep.path;
    this.tryItBody = ep.requestBody ? JSON.stringify(ep.requestBody, null, 2) : '';
    this.tryItResponse.set(null);
  }

  ngOnInit(): void {
    this.http.get<ApiEndpoint[]>('/api/admin/api-docs/endpoints').subscribe({
      next: (data) => {
        this.endpoints.set(data);
        const tags = [...new Set(data.map((e) => e.tag))];
        this.expandedTags.set(tags.slice(0, 2));
      }
    });
  }

  executeRequest(): void {
    this.executing.set(true);
    this.tryItResponse.set(null);
    const ep = this.selectedEndpoint()!;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.tryItApiKey) headers['Authorization'] = `Bearer ${this.tryItApiKey}`;
    const options = { headers, observe: 'response' as const, responseType: 'text' as const };

    let req$;
    const url = this.tryItUrl;
    const body = this.tryItBody;
    if (ep.method === 'GET')    req$ = this.http.get(url, options);
    else if (ep.method === 'POST')   req$ = this.http.post(url, body, options);
    else if (ep.method === 'PUT')    req$ = this.http.put(url, body, options);
    else if (ep.method === 'PATCH')  req$ = this.http.patch(url, body, options);
    else req$ = this.http.delete(url, options);

    req$.subscribe({
      next: (res: any) => {
        this.tryItStatus.set(res.status);
        try { this.tryItResponse.set(JSON.stringify(JSON.parse(res.body), null, 2)); }
        catch { this.tryItResponse.set(res.body); }
        this.executing.set(false);
      },
      error: (err: any) => {
        this.tryItStatus.set(err.status || 0);
        this.tryItResponse.set(err.message || 'Erro desconhecido');
        this.executing.set(false);
      },
    });
  }

  downloadSpec(): void {
    window.open('/api/admin/api-docs/openapi.json', '_blank');
  }
}
