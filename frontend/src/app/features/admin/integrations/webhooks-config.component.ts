import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  WebhookEndpoint,
  WebhookEventType,
  WebhookDeliveryConfig,
} from '../../../core/models/api-public.model';

interface EventCategory {
  name: string;
  icon: string;
  events: { type: WebhookEventType; label: string; description: string }[];
}

@Component({
  selector: 'app-webhooks-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="webhooks-config">
      <div class="page-header">
        <div>
          <h1>&#128680; Webhooks</h1>
          <p>Receba notifica\xE7\xF5es em tempo real quando eventos acontecem na plataforma.</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">+ Criar Webhook</button>
      </div>

      <!-- Lista -->
      @for (webhook of webhooks(); track webhook.id) {
        <div class="webhook-card" [class]="webhook.status">
          <div class="webhook-header">
            <div class="webhook-identity">
              <span class="webhook-status-dot" [class]="webhook.status"></span>
              <div>
                <h3>{{ webhook.name }}</h3>
                <code class="webhook-url">{{ webhook.url }}</code>
              </div>
            </div>
            <span class="webhook-status-badge" [class]="webhook.status">
              {{ webhook.status === 'active' ? 'Ativo' : webhook.status === 'failing' ? 'Falhando' : 'Pausado' }}
            </span>
          </div>

          <!-- Eventos assinados -->
          <div class="webhook-events">
            <span class="events-label">Eventos</span>
            <div class="event-chips">
              @for (event of webhook.events.slice(0, 5); track event) {
                <span class="event-chip">{{ event }}</span>
              }
              @if (webhook.events.length > 5) {
                <span class="event-chip more">+{{ webhook.events.length - 5 }}</span>
              }
            </div>
          </div>

          <!-- M\xE9tricas -->
          <div class="webhook-metrics">
            <div class="metric">
              <span class="metric-label">\xDAlt 24h</span>
              <span class="metric-value">{{ webhook.deliveries24h ?? 0 }} entregas</span>
            </div>
            <div class="metric">
              <span class="metric-label">Taxa sucesso</span>
              <span class="metric-value" [class.low]="(webhook.successRate ?? 100) < 90">
                {{ (webhook.successRate ?? 100) | number:'1.0-0' }}%
              </span>
            </div>
            <div class="metric">
              <span class="metric-label">Lat\xEAncia</span>
              <span class="metric-value">{{ webhook.avgLatencyMs ?? 0 }}ms</span>
            </div>
            <div class="metric">
              <span class="metric-label">\xDAlt entrega</span>
              <span class="metric-value">{{ webhook.lastDeliveryAt ? (webhook.lastDeliveryAt | date:'HH:mm') : 'Nunca' }}</span>
            </div>
            @if (webhook.consecutiveFailures > 0) {
              <div class="metric warning">
                <span class="metric-label">Falhas consecutivas</span>
                <span class="metric-value">{{ webhook.consecutiveFailures }}</span>
              </div>
            }
          </div>

          <div class="webhook-actions">
            <button (click)="testWebhook(webhook)">Testar</button>
            <button (click)="viewLogs(webhook)">Logs</button>
            <button (click)="editWebhook(webhook)">Editar</button>
            <button (click)="togglePause(webhook)">
              {{ webhook.status === 'paused' ? 'Ativar' : 'Pausar' }}
            </button>
            <button class="danger" (click)="deleteWebhook(webhook)">&#128465;&#65039;</button>
          </div>
        </div>
      }

      @if (webhooks().length === 0 && !loading()) {
        <div class="empty-state">
          <span>&#128680;</span>
          <p>Nenhum webhook configurado.</p>
        </div>
      }
    </div>

    <!-- Modal de cria\xE7\xE3o / edi\xE7\xE3o -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingWebhook() ? 'Editar' : 'Criar' }} Webhook</h2>
            <button (click)="closeModal()">&#10005;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Nome *
                <input [(ngModel)]="form.name" placeholder="Ex: Slack Notifications" autofocus />
              </label>
            </div>
            <div class="form-group">
              <label>URL do Endpoint *
                <input [(ngModel)]="form.url" type="url" placeholder="https://hooks.exemplo.com/webhook" />
                <span class="hint">Deve aceitar POST requests com JSON body</span>
              </label>
            </div>

            <!-- Secret -->
            <div class="form-group">
              <label>Secret HMAC-SHA256
                <div class="secret-field">
                  <code>{{ form.secret }}</code>
                  <button (click)="regenerateSecret()">Regenerar</button>
                  <button (click)="copySecret()">{{ secretCopied() ? '\u2705' : '\uD83D\uDCCB' }} Copiar</button>
                </div>
                <span class="hint">Use no header <code>X-Webhook-Signature</code> para verificar autenticidade.</span>
              </label>
            </div>

            <!-- Eventos -->
            <div class="form-group">
              <label>Eventos *</label>
              <div class="event-categories">
                @for (cat of eventCategories; track cat.name) {
                  <div class="event-category">
                    <div class="category-header">
                      <label class="checkbox-label">
                        <input type="checkbox"
                          [checked]="isCategoryFullySelected(cat)"
                          [indeterminate]="isCategoryPartiallySelected(cat)"
                          (change)="toggleAllInCategory(cat, $any($event.target).checked)" />
                        <strong>{{ cat.icon }} {{ cat.name }}</strong>
                      </label>
                    </div>
                    <div class="category-events">
                      @for (ev of cat.events; track ev.type) {
                        <label class="checkbox-label event-option">
                          <input type="checkbox"
                            [checked]="form.events.includes(ev.type)"
                            (change)="toggleEvent(ev.type)" />
                          <span>{{ ev.label }}</span>
                          <span class="event-description">{{ ev.description }}</span>
                        </label>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Configura\xE7\xE3o de entrega -->
            <details class="advanced-section">
              <summary>Configura\xE7\xE3o de entrega</summary>
              <div class="delivery-config">
                <div class="form-row">
                  <div class="form-group">
                    <label>Timeout (segundos)
                      <input type="number" [(ngModel)]="form.deliveryConfig.timeout" min="1" max="30" />
                    </label>
                  </div>
                  <div class="form-group">
                    <label>M\xE1x. retentativas
                      <input type="number" [(ngModel)]="form.deliveryConfig.maxRetries" min="0" max="10" />
                    </label>
                  </div>
                  <div class="form-group">
                    <label>Backoff
                      <select [(ngModel)]="form.deliveryConfig.retryBackoff">
                        <option value="linear">Linear (5s, 10s, 15s...)</option>
                        <option value="exponential">Exponencial (1s, 2s, 4s, 8s...)</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </details>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="save()" [disabled]="!isFormValid() || saving()">
              {{ saving() ? 'Salvando...' : (editingWebhook() ? 'Salvar' : 'Criar Webhook') }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class WebhooksConfigComponent implements OnInit {
  private http = inject(HttpClient);

  loading        = signal(true);
  saving         = signal(false);
  showModal      = signal(false);
  editingWebhook = signal<WebhookEndpoint | null>(null);
  webhooks       = signal<WebhookEndpoint[]>([]);
  secretCopied   = signal(false);

  form = this.emptyForm();

  eventCategories: EventCategory[] = [
    {
      name: 'Chat', icon: '\uD83D\uDCAC',
      events: [
        { type: 'chat.created',           label: 'Chat criado',        description: 'Nova conversa iniciada' },
        { type: 'chat.message.sent',      label: 'Mensagem enviada',   description: 'Usu\xE1rio enviou mensagem' },
        { type: 'chat.message.received',  label: 'Resposta gerada',    description: 'IA gerou resposta' },
        { type: 'chat.completed',         label: 'Chat finalizado',    description: 'Conversa encerrada' },
      ],
    },
    {
      name: 'Documentos', icon: '\uD83D\uDCC4',
      events: [
        { type: 'document.uploaded',           label: 'Documento enviado',          description: 'Upload conclu\xEDdo' },
        { type: 'document.processed',          label: 'Processamento conclu\xEDdo', description: 'Chunking e embedding prontos' },
        { type: 'document.deleted',            label: 'Documento exclu\xEDdo',      description: 'Documento removido' },
        { type: 'document.processing_failed',  label: 'Erro no processamento',      description: 'Processamento falhou' },
      ],
    },
    {
      name: 'Treinamento', icon: '\uD83E\uDDE0',
      events: [
        { type: 'training.feedback.received', label: 'Feedback recebido',  description: 'Thumb up/down enviado' },
        { type: 'training.batch.started',     label: 'Treino iniciado',    description: 'Ciclo de fine-tuning come\xE7ou' },
        { type: 'training.batch.completed',   label: 'Treino conclu\xEDdo', description: 'Fine-tuning terminou' },
        { type: 'training.model.deployed',    label: 'Modelo atualizado',  description: 'Novo LoRA ativado em produ\xE7\xE3o' },
      ],
    },
    {
      name: 'Seguran\xE7a', icon: '\uD83D\uDD12',
      events: [
        { type: 'security.pii_detected',  label: 'PII detectado',    description: 'Dados pessoais encontrados' },
        { type: 'security.access_denied', label: 'Acesso negado',    description: 'Tentativa de acesso bloqueada' },
        { type: 'user.login',             label: 'Login',            description: 'Usu\xE1rio fez login' },
        { type: 'user.created',           label: 'Usu\xE1rio criado', description: 'Novo usu\xE1rio provisionado' },
      ],
    },
  ];

  ngOnInit(): void {
    this.http.get<WebhookEndpoint[]>('/api/admin/webhooks').subscribe({
      next: (data) => { this.webhooks.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingWebhook.set(null);
    this.form = this.emptyForm();
    this.showModal.set(true);
  }

  editWebhook(webhook: WebhookEndpoint): void {
    this.editingWebhook.set(webhook);
    this.form = {
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: [...webhook.events],
      deliveryConfig: { ...webhook.deliveryConfig },
    };
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.editingWebhook.set(null); }

  isCategoryFullySelected(cat: EventCategory): boolean {
    return cat.events.every((e) => this.form.events.includes(e.type));
  }

  isCategoryPartiallySelected(cat: EventCategory): boolean {
    const count = cat.events.filter((e) => this.form.events.includes(e.type)).length;
    return count > 0 && count < cat.events.length;
  }

  toggleAllInCategory(cat: EventCategory, checked: boolean): void {
    for (const ev of cat.events) {
      if (checked && !this.form.events.includes(ev.type)) this.form.events.push(ev.type);
      if (!checked) this.form.events = this.form.events.filter((e) => e !== ev.type);
    }
  }

  toggleEvent(type: WebhookEventType): void {
    if (this.form.events.includes(type)) {
      this.form.events = this.form.events.filter((e) => e !== type);
    } else {
      this.form.events.push(type);
    }
  }

  regenerateSecret(): void { this.form.secret = this.genSecret(); }

  copySecret(): void {
    navigator.clipboard.writeText(this.form.secret);
    this.secretCopied.set(true);
    setTimeout(() => this.secretCopied.set(false), 2000);
  }

  isFormValid(): boolean {
    return !!this.form.name.trim() && !!this.form.url.trim() && this.form.events.length > 0;
  }

  save(): void {
    this.saving.set(true);
    const editing = this.editingWebhook();
    const req$ = editing
      ? this.http.put<WebhookEndpoint>(`/api/admin/webhooks/${editing.id}`, this.form)
      : this.http.post<WebhookEndpoint>('/api/admin/webhooks', this.form);

    req$.subscribe({
      next: () => {
        this.ngOnInit();
        this.closeModal();
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  testWebhook(webhook: WebhookEndpoint): void {
    this.http.post(`/api/admin/webhooks/${webhook.id}/test`, {}).subscribe({
      next: () => alert('Teste enviado! Verifique os Logs para o resultado.'),
      error: () => alert('Erro ao enviar teste.'),
    });
  }

  togglePause(webhook: WebhookEndpoint): void {
    const action = webhook.status === 'paused' ? 'resume' : 'pause';
    this.http.post(`/api/admin/webhooks/${webhook.id}/${action}`, {}).subscribe(() => this.ngOnInit());
  }

  deleteWebhook(webhook: WebhookEndpoint): void {
    if (!confirm(`Excluir webhook "${webhook.name}"?`)) return;
    this.http.delete(`/api/admin/webhooks/${webhook.id}`).subscribe(() => this.ngOnInit());
  }

  viewLogs(webhook: WebhookEndpoint): void {
    // Navega para a tela de logs (implementada em webhook-logs.component.ts)
    window.location.href = `/admin/integrations/webhooks/${webhook.id}/logs`;
  }

  private emptyForm() {
    return {
      name: '',
      url: '',
      secret: this.genSecret(),
      events: [] as WebhookEventType[],
      deliveryConfig: { timeout: 10, maxRetries: 5, retryBackoff: 'exponential' } as WebhookDeliveryConfig,
    };
  }

  private genSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return 'whsec_' + Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
