import { Component, OnInit, inject, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WebhookDelivery, WebhookDeliveryStatus, WebhookEventType } from '../../../core/models/api-public.model';

@Component({
  selector: 'app-webhook-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="webhook-logs">
      <div class="page-header">
        <h2>&#128196; Logs de Entrega</h2>
        <div class="log-filters">
          <select [(ngModel)]="statusFilter" (ngModelChange)="loadLogs()">
            <option value="">Todos os status</option>
            <option value="delivered">Entregues &#9989;</option>
            <option value="failed">Falharam &#10060;</option>
            <option value="retrying">Retentando &#128260;</option>
            <option value="pending">Pendentes &#9203;</option>
          </select>
          <select [(ngModel)]="eventFilter" (ngModelChange)="loadLogs()">
            <option value="">Todos os eventos</option>
            @for (cat of eventGroups; track cat.label) {
              <optgroup [label]="cat.label">
                @for (ev of cat.events; track ev) {
                  <option [value]="ev">{{ ev }}</option>
                }
              </optgroup>
            }
          </select>
          <button class="btn-secondary" (click)="loadLogs()">&#8635; Atualizar</button>
        </div>
      </div>

      <!-- Tabela de logs -->
      <div class="logs-list">
        @for (delivery of deliveries(); track delivery.id) {
          <div class="log-entry" [class]="delivery.status" (click)="toggleDetail(delivery)">
            <div class="log-summary">
              <span class="log-status-icon">
                @switch (delivery.status) {
                  @case ('delivered') { &#9989; }
                  @case ('failed')    { &#10060; }
                  @case ('retrying')  { &#128260; }
                  @case ('pending')   { &#9203; }
                }
              </span>
              <span class="log-event">{{ delivery.event }}</span>
              <span class="log-id">{{ delivery.id.slice(0, 8) }}</span>
              @if (delivery.httpStatus) {
                <span class="log-status" [class.ok]="delivery.httpStatus < 400" [class.err]="delivery.httpStatus >= 400">
                  HTTP {{ delivery.httpStatus }}
                </span>
              }
              @if (delivery.responseTimeMs) {
                <span class="log-latency">{{ delivery.responseTimeMs }}ms</span>
              }
              <span class="log-attempt">Tentativa {{ delivery.attemptNumber }}</span>
              <span class="log-time">{{ delivery.createdAt | date:'HH:mm:ss' }}</span>
            </div>

            <!-- Detalhes expandidos -->
            @if (expandedId() === delivery.id) {
              <div class="log-detail">
                <div class="detail-section">
                  <h4>Payload</h4>
                  <pre class="json-viewer">{{ delivery.payload | json }}</pre>
                </div>
                @if (delivery.responseBody) {
                  <div class="detail-section">
                    <h4>Response Body</h4>
                    <pre class="json-viewer">{{ delivery.responseBody }}</pre>
                  </div>
                }
                @if (delivery.errorMessage) {
                  <div class="detail-section error">
                    <h4>Erro</h4>
                    <pre>{{ delivery.errorMessage }}</pre>
                  </div>
                }
                <div class="detail-meta">
                  <span>Agendado: {{ delivery.scheduledAt | date:'dd/MM HH:mm:ss' }}</span>
                  @if (delivery.deliveredAt) {
                    <span>Entregue: {{ delivery.deliveredAt | date:'dd/MM HH:mm:ss' }}</span>
                  }
                  @if (delivery.nextRetryAt) {
                    <span>Pr\xF3ximo retry: {{ delivery.nextRetryAt | date:'dd/MM HH:mm:ss' }}</span>
                  }
                </div>
                <div class="detail-actions">
                  <button class="btn-secondary btn-sm" (click)="resend(delivery); $event.stopPropagation()">&#128260; Reenviar</button>
                </div>
              </div>
            }
          </div>
        }
        @if (deliveries().length === 0 && !loading()) {
          <div class="empty-state">Nenhum log encontrado para os filtros selecionados.</div>
        }
      </div>

      <!-- Pagina\xE7\xE3o -->
      @if (hasMore()) {
        <div class="load-more">
          <button class="btn-secondary" (click)="loadMore()" [disabled]="loading()">
            {{ loading() ? 'Carregando...' : 'Carregar mais' }}
          </button>
        </div>
      }
    </div>
  `
})
export class WebhookLogsComponent implements OnInit {
  @Input() webhookId!: string;

  private http = inject(HttpClient);

  loading      = signal(false);
  deliveries   = signal<WebhookDelivery[]>([]);
  expandedId   = signal<string | null>(null);
  hasMore      = signal(false);

  statusFilter: WebhookDeliveryStatus | '' = '';
  eventFilter: WebhookEventType | ''       = '';
  page = 1;
  perPage = 50;

  eventGroups = [
    { label: 'Chat',         events: ['chat.created', 'chat.message.sent', 'chat.message.received', 'chat.completed'] },
    { label: 'Documentos',   events: ['document.uploaded', 'document.processed', 'document.deleted', 'document.processing_failed'] },
    { label: 'Treinamento',  events: ['training.feedback.received', 'training.batch.started', 'training.batch.completed', 'training.model.deployed'] },
    { label: 'Seguran\xE7a', events: ['security.pii_detected', 'security.access_denied', 'user.login', 'user.created'] },
  ];

  ngOnInit(): void { this.loadLogs(); }

  loadLogs(): void {
    this.page = 1;
    this.loading.set(true);
    const params = this.buildParams();
    this.http.get<{ items: WebhookDelivery[]; hasMore: boolean }>(
      `/api/admin/webhooks/${this.webhookId}/deliveries`, { params }
    ).subscribe({
      next: (res) => {
        this.deliveries.set(res.items);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadMore(): void {
    this.page++;
    this.loading.set(true);
    const params = this.buildParams();
    this.http.get<{ items: WebhookDelivery[]; hasMore: boolean }>(
      `/api/admin/webhooks/${this.webhookId}/deliveries`, { params }
    ).subscribe({
      next: (res) => {
        this.deliveries.update((prev) => [...prev, ...res.items]);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleDetail(delivery: WebhookDelivery): void {
    this.expandedId.set(this.expandedId() === delivery.id ? null : delivery.id);
  }

  resend(delivery: WebhookDelivery): void {
    this.http.post(`/api/admin/webhooks/${this.webhookId}/deliveries/${delivery.id}/resend`, {}).subscribe({
      next: () => { alert('Reenvio agendado!'); this.loadLogs(); },
    });
  }

  private buildParams(): Record<string, string> {
    const p: Record<string, string> = { page: String(this.page), perPage: String(this.perPage) };
    if (this.statusFilter) p['status'] = this.statusFilter;
    if (this.eventFilter)  p['event']  = this.eventFilter;
    return p;
  }
}
