import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface WebhookDelivery {
  id: string;
  webhookId: string;
  webhookName: string;
  event: string;
  url: string;
  requestBody: string;
  requestHeaders: Record<string, string>;
  responseStatus: number | null;
  responseBody: string | null;
  durationMs: number | null;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  deliveredAt: string | null;
  nextRetryAt: string | null;
}

@Component({
  selector: 'app-webhook-logs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="webhook-logs">
      <div class="page-header">
        <button class="btn-ghost" routerLink="/admin/integrations/webhooks">&#8592; Voltar</button>
        <div>
          <h1>&#128203; Logs de Entrega</h1>
          <p>{{ webhookName() }}</p>
        </div>
        <button class="btn-secondary" (click)="load()">&#8635; Atualizar</button>
      </div>

      <!-- Filtros -->
      <div class="filters-bar">
        @for (tab of statusTabs; track tab.value) {
          <button class="chip" [class.active]="filterStatus() === tab.value" (click)="filterStatus.set(tab.value); load()">
            {{ tab.label }}
          </button>
        }
      </div>

      <!-- Lista -->
      <div class="deliveries-list">
        @if (loading()) {
          <div class="loading-state">Carregando...</div>
        } @else if (deliveries().length === 0) {
          <div class="empty-state">Nenhuma entrega encontrada.</div>
        } @else {
          @for (d of deliveries(); track d.id) {
            <div class="delivery-card" [class]="d.status" (click)="toggleDetail(d)">
              <div class="delivery-header">
                <div class="delivery-identity">
                  <span class="status-icon">
                    {{ d.status === 'success' ? '✅' : d.status === 'failed' ? '❌' : d.status === 'retrying' ? '🔄' : '⏳' }}
                  </span>
                  <span class="event-name">{{ d.event }}</span>
                  @if (d.responseStatus) {
                    <span class="http-status" [class.ok]="d.responseStatus < 300" [class.err]="d.responseStatus >= 400">
                      HTTP {{ d.responseStatus }}
                    </span>
                  }
                  @if (d.attempt > 1) {
                    <span class="attempt-badge">tentativa {{ d.attempt }}/{{ d.maxAttempts }}</span>
                  }
                </div>
                <div class="delivery-meta">
                  @if (d.durationMs) { <span>{{ d.durationMs }}ms</span> }
                  <span>{{ d.createdAt | date:'dd/MM HH:mm:ss' }}</span>
                  @if (d.status === 'failed' && d.attempt < d.maxAttempts) {
                    <button class="btn-sm btn-secondary" (click)="retryDelivery(d); $event.stopPropagation()"
                      [disabled]="retrying() === d.id">
                      {{ retrying() === d.id ? 'Reenviando...' : '&#8635; Reenviar' }}
                    </button>
                  }
                </div>
              </div>

              <!-- Detalhe expandido -->
              @if (expandedId() === d.id) {
                <div class="delivery-detail" (click)="$event.stopPropagation()">
                  <div class="detail-col">
                    <h4>Request Body</h4>
                    <pre>{{ formatJson(d.requestBody) }}</pre>
                  </div>
                  @if (d.responseBody) {
                    <div class="detail-col">
                      <h4>Response Body</h4>
                      <pre>{{ formatJson(d.responseBody) }}</pre>
                    </div>
                  }
                  <div class="detail-col">
                    <h4>Request Headers</h4>
                    <pre>{{ formatJson(JSON.stringify(d.requestHeaders)) }}</pre>
                  </div>
                  @if (d.nextRetryAt) {
                    <p class="next-retry">&#128337; Próxima tentativa: {{ d.nextRetryAt | date:'dd/MM HH:mm:ss' }}</p>
                  }
                </div>
              }
            </div>
          }
        }
      </div>

      <!-- Paginação -->
      <div class="pagination">
        <button [disabled]="page() <= 1" (click)="prevPage()">&#8592; Anterior</button>
        <span>Página {{ page() }}</span>
        <button [disabled]="deliveries().length < perPage" (click)="nextPage()">Próxima &#8594;</button>
      </div>
    </div>
  `
})
export class WebhookLogsComponent implements OnInit {
  private http  = inject(HttpClient);
  private route = inject(ActivatedRoute);

  loading      = signal(false);
  retrying     = signal<string | null>(null);
  filterStatus = signal<'all' | 'success' | 'failed' | 'retrying'>('all');
  deliveries   = signal<WebhookDelivery[]>([]);
  expandedId   = signal<string | null>(null);
  webhookName  = signal('');
  page         = signal(1);
  perPage      = 20;

  webhookId = '';

  statusTabs = [
    { value: 'all',      label: 'Todas' },
    { value: 'success',  label: '✅ Sucesso' },
    { value: 'failed',   label: '❌ Falha' },
    { value: 'retrying', label: '🔄 Reenvio' },
  ];

  JSON = JSON;

  ngOnInit(): void {
    this.webhookId = this.route.snapshot.paramMap.get('webhookId') ?? '';
    this.loadWebhookInfo();
    this.load();
  }

  loadWebhookInfo(): void {
    this.http.get<{ name: string }>(`/api/admin/webhooks/${this.webhookId}`)
      .subscribe((wh) => this.webhookName.set(wh.name));
  }

  load(): void {
    this.loading.set(true);
    const params = `?page=${this.page()}&perPage=${this.perPage}&status=${this.filterStatus()}`;
    this.http.get<WebhookDelivery[]>(`/api/admin/webhooks/${this.webhookId}/deliveries${params}`).subscribe({
      next: (data) => { this.deliveries.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleDetail(d: WebhookDelivery): void {
    this.expandedId.set(this.expandedId() === d.id ? null : d.id);
  }

  retryDelivery(d: WebhookDelivery): void {
    this.retrying.set(d.id);
    this.http.post(`/api/admin/webhooks/${this.webhookId}/deliveries/${d.id}/retry`, {}).subscribe({
      next: () => { this.retrying.set(null); this.load(); },
      error: () => this.retrying.set(null),
    });
  }

  prevPage(): void { if (this.page() > 1) { this.page.update((p) => p - 1); this.load(); } }
  nextPage(): void { this.page.update((p) => p + 1); this.load(); }

  formatJson(raw: string): string {
    try { return JSON.stringify(JSON.parse(raw), null, 2); }
    catch { return raw; }
  }
}
