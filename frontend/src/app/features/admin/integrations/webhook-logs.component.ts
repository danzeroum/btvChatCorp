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
  `,
  styles: [`
    :host { display:block; font-family: Inter, system-ui, sans-serif; }
    .webhook-logs { padding: 28px 32px; background: #f8fafc; min-height: 100vh; }
    .page-header { display:flex; align-items:center; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
    .page-header h1 { font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .page-header p { font-size:13px; color:#64748b; margin:0; }
    .btn-ghost { background:none; border:1px solid #e2e8f0; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:13px; color:#374151; }
    .btn-secondary { background:#f1f5f9; color:#374151; border:1px solid #e2e8f0; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; }
    .btn-sm { padding:5px 12px; font-size:12px; }
    .filters-bar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .chip { padding:5px 14px; border:1px solid #e2e8f0; border-radius:20px; background:#fff; color:#374151; font-size:12px; cursor:pointer; }
    .chip.active { background:#6366f1; color:#fff; border-color:#6366f1; }
    .deliveries-list { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
    .loading-state { text-align:center; padding:40px; color:#94a3b8; font-size:14px; }
    .empty-state { text-align:center; padding:40px; color:#94a3b8; font-size:14px; }
    .delivery-card { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:14px 18px; cursor:pointer; transition:background 0.15s; }
    .delivery-card:hover { background:#f8fafc; }
    .delivery-card.success { border-left:3px solid #16a34a; }
    .delivery-card.failed { border-left:3px solid #ef4444; }
    .delivery-card.retrying { border-left:3px solid #f59e0b; }
    .delivery-card.pending { border-left:3px solid #6366f1; }
    .delivery-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
    .delivery-identity { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .status-icon { font-size:14px; }
    .event-name { font-size:13px; font-weight:500; color:#0f172a; }
    .http-status { font-size:12px; padding:2px 8px; border-radius:4px; font-weight:500; }
    .http-status.ok { background:#dcfce7; color:#15803d; }
    .http-status.err { background:#fee2e2; color:#991b1b; }
    .attempt-badge { font-size:11px; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; }
    .delivery-meta { display:flex; align-items:center; gap:10px; font-size:12px; color:#64748b; }
    .delivery-detail { margin-top:14px; border-top:1px solid #e2e8f0; padding-top:14px; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .detail-col h4 { font-size:12px; font-weight:600; color:#0f172a; margin:0 0 6px; }
    .detail-col pre { background:#1e293b; color:#e2e8f0; border-radius:8px; padding:10px; font-size:11px; overflow:auto; max-height:180px; margin:0; }
    .next-retry { font-size:12px; color:#f59e0b; margin:8px 0 0; grid-column:1/-1; }
    .pagination { display:flex; align-items:center; justify-content:center; gap:16px; padding:16px; }
    .pagination button { padding:7px 16px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#374151; font-size:13px; cursor:pointer; }
    .pagination button:disabled { opacity:0.4; cursor:not-allowed; }
    .pagination span { font-size:13px; color:#64748b; }
  `]
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

  statusTabs: { value: 'all' | 'success' | 'failed' | 'retrying'; label: string }[] = [
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
    this.http.get<{ name: string }>(`/api/v1/admin/webhooks/${this.webhookId}`)
      .subscribe((wh) => this.webhookName.set(wh.name));
  }

  load(): void {
    this.loading.set(true);
    const params = `?page=${this.page()}&per_page=${this.perPage}&status=${this.filterStatus()}`;
    this.http.get<WebhookDelivery[]>(`/api/v1/admin/webhooks/${this.webhookId}/deliveries${params}`).subscribe({
      next: (data) => { this.deliveries.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleDetail(d: WebhookDelivery): void {
    this.expandedId.set(this.expandedId() === d.id ? null : d.id);
  }

  retryDelivery(d: WebhookDelivery): void {
    this.retrying.set(d.id);
    this.http.post(`/api/v1/admin/webhooks/${this.webhookId}/deliveries/${d.id}/retry`, {}).subscribe({
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
