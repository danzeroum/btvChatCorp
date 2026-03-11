import { Component, OnInit, inject, signal, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
                    <span class="stat-count">{{ endpointsByTag(tag).length }}</span>
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
                    <div class="response-status">HTTP {{ tryItStatus() }}</div>
                    <pre><code>{{ tryItResponse() }}</code></pre>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
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
        this.expandedTags.set(tags.slice(0, 2)); // expande primeiras 2 categorias
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
