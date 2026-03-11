import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;           // HMAC-SHA256 secret
  events: string[];
  status: 'active' | 'paused' | 'failing';
  lastDeliveryAt: string | null;
  lastDeliveryStatus: number | null;  // HTTP status code
  successRate: number;      // 0-100
  totalDeliveries: number;
  createdAt: string;
  retryPolicy: 'none' | '3x' | '5x_exponential';
  timeoutMs: number;
}

@Component({
  selector: 'app-webhooks-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="webhooks-config">
      <div class="page-header">
        <div>
          <h1>&#128279; Webhooks</h1>
          <p>Receba notificações em tempo real sobre eventos da plataforma.</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">+ Novo Webhook</button>
      </div>

      <!-- Eventos disponíveis -->
      <div class="events-reference">
        <h3>Eventos disponíveis</h3>
        <div class="events-chips">
          @for (evt of availableEvents; track evt.value) {
            <span class="event-chip" [title]="evt.description">{{ evt.value }}</span>
          }
        </div>
      </div>

      <!-- Lista de webhooks -->
      <div class="webhooks-list">
        @if (loading()) {
          <div class="loading-state">Carregando...</div>
        } @else if (webhooks().length === 0) {
          <div class="empty-state">Nenhum webhook configurado ainda.</div>
        } @else {
          @for (wh of webhooks(); track wh.id) {
            <div class="webhook-card" [class.failing]="wh.status === 'failing'" [class.paused]="wh.status === 'paused'">
              <div class="webhook-header">
                <div class="webhook-identity">
                  <span class="webhook-name">{{ wh.name }}</span>
                  <span class="webhook-url">{{ wh.url }}</span>
                  <span class="status-badge" [class]="wh.status">{{ wh.status }}</span>
                </div>
                <div class="webhook-actions">
                  <button class="btn-ghost btn-sm" (click)="testWebhook(wh)" [disabled]="testing() === wh.id">
                    {{ testing() === wh.id ? '⏳' : '🧪' }} Testar
                  </button>
                  <button class="btn-secondary btn-sm" (click)="editWebhook(wh)">Editar</button>
                  <button class="btn-ghost btn-sm" [routerLink]="['/admin/integrations/webhooks', wh.id, 'logs']">&#128203; Logs</button>
                  <button class="btn-ghost btn-sm" (click)="toggleStatus(wh)">
                    {{ wh.status === 'active' ? '⏸️ Pausar' : '▶️ Ativar' }}
                  </button>
                  <button class="btn-ghost btn-sm" (click)="deleteWebhook(wh)">&#128465;&#65039;</button>
                </div>
              </div>

              <div class="webhook-stats">
                <div class="stat">
                  <span class="stat-label">Eventos inscritos</span>
                  <div class="event-chips-sm">
                    @for (evt of wh.events; track evt) {
                      <span class="event-chip-sm">{{ evt }}</span>
                    }
                  </div>
                </div>
                <div class="stat">
                  <span class="stat-label">Taxa de sucesso</span>
                  <div class="success-bar">
                    <div class="success-fill" [style.width.%]="wh.successRate"
                      [class.warn]="wh.successRate < 80" [class.critical]="wh.successRate < 50">
                    </div>
                  </div>
                  <span>{{ wh.successRate | number:'1.0-0' }}% ({{ wh.totalDeliveries }} entregas)</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Última entrega</span>
                  <span [class.error]="wh.lastDeliveryStatus && wh.lastDeliveryStatus >= 400">
                    {{ wh.lastDeliveryAt ? (wh.lastDeliveryAt | date:'dd/MM HH:mm') : 'Nunca' }}
                    @if (wh.lastDeliveryStatus) { — HTTP {{ wh.lastDeliveryStatus }} }
                  </span>
                </div>
                <div class="stat">
                  <span class="stat-label">Timeout / Retry</span>
                  <span>{{ wh.timeoutMs }}ms / {{ wh.retryPolicy }}</span>
                </div>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal webhook-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingWebhook() ? 'Editar' : 'Novo' }} Webhook</h2>
            <button (click)="closeModal()">&#10005;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Nome *
                <input [(ngModel)]="form.name" placeholder="ex: Notificações ERP" />
              </label>
            </div>
            <div class="form-group">
              <label>URL de destino *
                <input [(ngModel)]="form.url" placeholder="https://seu-sistema.com/webhook" type="url" />
              </label>
            </div>
            <div class="form-group">
              <label>Secret (HMAC-SHA256)
                <div class="secret-input">
                  <input [(ngModel)]="form.secret" placeholder="Gerado automaticamente se vazio" />
                  <button type="button" (click)="generateSecret()">&#128273; Gerar</button>
                </div>
              </label>
            </div>
            <div class="form-group">
              <label>Eventos a receber
                <div class="events-checkboxes">
                  @for (evt of availableEvents; track evt.value) {
                    <label class="checkbox-label">
                      <input type="checkbox" [checked]="form.events?.includes(evt.value)"
                        (change)="toggleEvent(evt.value, $event)" />
                      <span>{{ evt.value }}</span>
                      <span class="evt-desc">{{ evt.description }}</span>
                    </label>
                  }
                </div>
              </label>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Timeout (ms)
                  <input type="number" [(ngModel)]="form.timeoutMs" placeholder="5000" />
                </label>
              </div>
              <div class="form-group">
                <label>Política de retry
                  <select [(ngModel)]="form.retryPolicy">
                    <option value="none">Sem retry</option>
                    <option value="3x">3× imediato</option>
                    <option value="5x_exponential">5× exponencial</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="save()" [disabled]="saving() || !form.name || !form.url">
              {{ saving() ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class WebhooksConfigComponent implements OnInit {
  private http = inject(HttpClient);

  loading        = signal(false);
  saving         = signal(false);
  testing        = signal<string | null>(null);
  showModal      = signal(false);
  editingWebhook = signal<Webhook | null>(null);
  webhooks       = signal<Webhook[]>([]);
  form: Partial<Webhook> & { events: string[] } = this.emptyForm();

  availableEvents = [
    { value: 'chat.created',         description: 'Nova conversa iniciada' },
    { value: 'chat.message.sent',     description: 'Mensagem enviada' },
    { value: 'chat.feedback.given',   description: 'Feedback (👍/👎) dado' },
    { value: 'document.uploaded',     description: 'Documento enviado' },
    { value: 'document.processed',    description: 'Documento indexado' },
    { value: 'project.created',       description: 'Novo projeto criado' },
    { value: 'user.invited',          description: 'Usuário convidado' },
    { value: 'user.login',            description: 'Login realizado' },
    { value: 'training.completed',    description: 'Ciclo de treino concluído' },
    { value: 'training.deployed',     description: 'LoRA adapter ativado' },
    { value: 'security.access_denied',description: 'Acesso negado detectado' },
    { value: 'billing.limit_reached', description: 'Limite de recurso atingido' },
  ];

  ngOnInit(): void { this.loadWebhooks(); }

  loadWebhooks(): void {
    this.loading.set(true);
    this.http.get<Webhook[]>('/api/admin/webhooks').subscribe({
      next: (data) => { this.webhooks.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void { this.editingWebhook.set(null); this.form = this.emptyForm(); this.showModal.set(true); }

  editWebhook(wh: Webhook): void {
    this.editingWebhook.set(wh);
    this.form = { ...wh, events: [...wh.events] };
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.editingWebhook.set(null); }

  toggleEvent(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) { this.form.events = [...this.form.events, value]; }
    else { this.form.events = this.form.events.filter((e) => e !== value); }
  }

  generateSecret(): void {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    this.form.secret = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  save(): void {
    this.saving.set(true);
    const editing = this.editingWebhook();
    const req$ = editing
      ? this.http.put(`/api/admin/webhooks/${editing.id}`, this.form)
      : this.http.post('/api/admin/webhooks', this.form);
    req$.subscribe({ next: () => { this.loadWebhooks(); this.closeModal(); this.saving.set(false); }, error: () => this.saving.set(false) });
  }

  testWebhook(wh: Webhook): void {
    this.testing.set(wh.id);
    this.http.post(`/api/admin/webhooks/${wh.id}/test`, {}).subscribe({
      next: () => { this.testing.set(null); alert('Entrega de teste enviada com sucesso!'); },
      error: () => { this.testing.set(null); alert('Falha ao enviar entrega de teste.'); },
    });
  }

  toggleStatus(wh: Webhook): void {
    const action = wh.status === 'active' ? 'pause' : 'activate';
    this.http.patch(`/api/admin/webhooks/${wh.id}/${action}`, {}).subscribe(() => this.loadWebhooks());
  }

  deleteWebhook(wh: Webhook): void {
    if (!confirm(`Excluir webhook "${wh.name}"?`)) return;
    this.http.delete(`/api/admin/webhooks/${wh.id}`).subscribe(() => this.loadWebhooks());
  }

  private emptyForm(): Partial<Webhook> & { events: string[] } {
    return { name: '', url: '', secret: '', events: [], retryPolicy: '3x', timeoutMs: 5000 };
  }
}
