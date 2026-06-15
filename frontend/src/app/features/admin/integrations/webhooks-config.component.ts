import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { StatusPillComponent } from '../shared/status-pill.component';
import { MiniBarComponent } from '../shared/mini-bar.component';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  status: 'active' | 'paused' | 'failing';
  lastDeliveryAt: string | null;
  lastDeliveryStatus: number | null;
  successRate: number;
  totalDeliveries: number;
  createdAt: string;
  retryPolicy: 'none' | '3x' | '5x_exponential';
  timeoutMs: number;
}

@Component({
  selector: 'app-webhooks-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterModule, StatusPillComponent, MiniBarComponent],
  template: `
    <div class="admin-page">
      <div class="breadcrumb">
        <a routerLink="/admin/dashboard" class="bc-link">Dashboard</a>
        <span class="bc-sep">/</span>
        <span>Webhooks</span>
      </div>

      <div class="admin-header">
        <div>
          <h1>Webhooks</h1>
          <p class="page-sub">Receba notificações em tempo real sobre eventos da plataforma</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">+ Novo Webhook</button>
      </div>

      <!-- Available events reference -->
      <div class="events-ref">
        <span class="ref-label">Eventos disponíveis:</span>
        @for (evt of availableEvents; track evt.value) {
          <span class="ev-chip" [title]="evt.description">{{ evt.value }}</span>
        }
      </div>

      <!-- Webhook list -->
      @if (loading()) {
        <div class="loading-hint">Carregando webhooks…</div>
      } @else if (webhooks().length === 0) {
        <div class="empty-card">
          <span class="empty-icon">🔗</span>
          <span class="empty-title">Nenhum webhook configurado</span>
          <span class="empty-sub">Adicione um endpoint para receber eventos do ChatCorp.</span>
        </div>
      } @else {
        <div class="wh-list">
          @for (wh of webhooks(); track wh.id) {
            <div class="wh-card" [class.wh-failing]="wh.status === 'failing'" [class.wh-paused]="wh.status === 'paused'">
              <div class="wh-top">
                <div class="wh-identity">
                  <span class="wh-name">{{ wh.name }}</span>
                  <code class="wh-url mono">{{ wh.url }}</code>
                  <app-status-pill [kind]="whKind(wh.status)">{{ whLabel(wh.status) }}</app-status-pill>
                </div>
                <div class="wh-actions">
                  <button class="btn-sm btn-ghost" (click)="testWebhook(wh)" [disabled]="testing() === wh.id">
                    {{ testing() === wh.id ? 'Enviando…' : 'Testar' }}
                  </button>
                  <button class="btn-sm btn-ghost" (click)="editWebhook(wh)">Editar</button>
                  <a class="btn-sm btn-ghost" [routerLink]="['/admin/integrations/webhooks', wh.id, 'logs']">Logs</a>
                  <button class="btn-sm btn-ghost" (click)="toggleStatus(wh)">
                    {{ wh.status === 'active' ? 'Pausar' : 'Ativar' }}
                  </button>
                  <button class="btn-sm btn-ghost-acc" (click)="deleteWebhook(wh)">Excluir</button>
                </div>
              </div>
              <div class="wh-stats">
                <div class="stat-col">
                  <span class="stat-label">Eventos</span>
                  <div class="ev-tags">
                    @for (evt of wh.events; track evt) {
                      <span class="ev-tag-sm">{{ evt }}</span>
                    }
                  </div>
                </div>
                <div class="stat-col">
                  <span class="stat-label">Taxa de sucesso</span>
                  <div class="bar-row">
                    <app-mini-bar [value]="wh.successRate" [max]="100" height="6px"
                                  [color]="wh.successRate < 50 ? 'var(--acc)' : wh.successRate < 80 ? 'var(--warn)' : 'var(--good)'" />
                    <span class="mono ink-3">{{ wh.successRate | number:'1.0-0' }}%</span>
                  </div>
                  <span class="stat-sub">{{ wh.totalDeliveries | number }} entregas</span>
                </div>
                <div class="stat-col">
                  <span class="stat-label">Última entrega</span>
                  <span class="mono" [class.err]="(wh.lastDeliveryStatus ?? 0) >= 400">
                    {{ wh.lastDeliveryAt ? (wh.lastDeliveryAt | date:'dd/MM HH:mm') : 'Nunca' }}
                    @if (wh.lastDeliveryStatus) { — HTTP {{ wh.lastDeliveryStatus }} }
                  </span>
                </div>
                <div class="stat-col">
                  <span class="stat-label">Timeout / Retry</span>
                  <span class="mono ink-3">{{ wh.timeoutMs }}ms / {{ wh.retryPolicy }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (showModal()) {
      <div class="modal-scrim" (click)="closeModal()">
        <div class="modal-card wh-modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2>{{ editingWebhook() ? 'Editar' : 'Novo' }} Webhook</h2>
            <button class="modal-close" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <label class="form-label">Nome *
              <input [(ngModel)]="form.name" class="form-input" placeholder="Notificações ERP" />
            </label>
            <label class="form-label">URL de destino *
              <input [(ngModel)]="form.url" class="form-input" type="url" placeholder="https://seu-sistema.com/webhook" />
            </label>
            <label class="form-label">Secret (HMAC-SHA256)
              <div class="secret-row">
                <input [(ngModel)]="form.secret" class="form-input" placeholder="Gerado automaticamente se vazio" />
                <button type="button" class="btn-ghost btn-sm" (click)="generateSecret()">Gerar</button>
              </div>
            </label>
            <span class="form-label">Eventos</span>
            <div class="evt-checks">
              @for (evt of availableEvents; track evt.value) {
                <label class="evt-check">
                  <input type="checkbox" [checked]="form.events.includes(evt.value)"
                         (change)="toggleEvent(evt.value, $event)" />
                  <span class="evt-name">{{ evt.value }}</span>
                  <span class="evt-desc">{{ evt.description }}</span>
                </label>
              }
            </div>
            <div class="form-grid">
              <label class="form-label">Timeout (ms)
                <input type="number" [(ngModel)]="form.timeoutMs" class="form-input" placeholder="5000" />
              </label>
              <label class="form-label">Retry
                <select [(ngModel)]="form.retryPolicy" class="form-input">
                  <option value="none">Sem retry</option>
                  <option value="3x">3× imediato</option>
                  <option value="5x_exponential">5× exponencial</option>
                </select>
              </label>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn-ghost" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="save()" [disabled]="saving() || !form.name || !form.url">
              {{ saving() ? 'Salvando…' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .admin-page { padding: 28px 32px; font-family: 'IBM Plex Sans', system-ui, sans-serif; max-width: 1100px; }
    .breadcrumb { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-3); margin-bottom:16px; }
    .bc-link { color:var(--ink-2); text-decoration:none; }
    .bc-link:hover { color:var(--ink); }
    .bc-sep { color:var(--line); }
    .admin-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; }
    .admin-header h1 { font-size:20px; font-weight:600; color:var(--ink); margin:0 0 4px; }
    .page-sub { font-size:13px; color:var(--ink-3); margin:0; }
    .btn-primary { padding:8px 18px; background:var(--acc); color:var(--white); border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
    .btn-ghost { background:none; border:1px solid var(--line); border-radius:8px; padding:7px 14px; font-size:13px; color:var(--ink-2); cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; }
    .btn-ghost:hover { background:var(--panel-2); }
    .btn-ghost:disabled { opacity:.5; cursor:not-allowed; }
    .btn-ghost-acc { background:none; border:1px solid var(--acc-line); color:var(--acc); border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer; }
    .btn-ghost-acc:hover { background:var(--acc-soft); }
    .btn-sm { padding:5px 12px; border-radius:6px; font-size:12px; }
    .events-ref { display:flex; flex-wrap:wrap; align-items:center; gap:6px; background:var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:10px 16px; margin-bottom:16px; }
    .ref-label { font-size:12px; font-weight:600; color:var(--ink-3); flex-shrink:0; }
    .ev-chip { background:var(--white); border:1px solid var(--line); color:var(--ink-2); font-size:11px; padding:2px 9px; border-radius:999px; cursor:default; font-family:'IBM Plex Mono', monospace; }
    .loading-hint { text-align:center; padding:40px; font-size:13px; color:var(--ink-3); }
    .empty-card { display:flex; flex-direction:column; align-items:center; gap:8px; padding:60px 24px; background:var(--white); border:1px solid var(--line); border-radius:10px; }
    .empty-icon { font-size:28px; }
    .empty-title { font-size:14px; font-weight:600; color:var(--ink); }
    .empty-sub { font-size:13px; color:var(--ink-3); }
    .wh-list { display:flex; flex-direction:column; gap:10px; }
    .wh-card { background:var(--white); border:1px solid var(--line); border-radius:10px; padding:18px 22px; }
    .wh-failing { border-left:3px solid var(--acc); }
    .wh-paused { border-left:3px solid var(--warn); opacity:.85; }
    .wh-top { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
    .wh-identity { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .wh-name { font-size:14px; font-weight:600; color:var(--ink); }
    .wh-url { font-size:11.5px; color:var(--ink-3); background:var(--panel-2); border:1px solid var(--line); border-radius:4px; padding:2px 8px; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .wh-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .wh-stats { display:flex; flex-wrap:wrap; gap:20px; }
    .stat-col { display:flex; flex-direction:column; gap:5px; min-width:130px; }
    .stat-label { font-size:11px; font-weight:600; color:var(--ink-3); text-transform:uppercase; letter-spacing:.04em; }
    .stat-sub { font-size:11.5px; color:var(--ink-3); }
    .ev-tags { display:flex; flex-wrap:wrap; gap:4px; }
    .ev-tag-sm { background:var(--panel-2); color:var(--ink-2); font-size:10.5px; padding:2px 7px; border-radius:4px; font-family:'IBM Plex Mono', monospace; }
    .bar-row { display:flex; align-items:center; gap:8px; }
    .err { color:var(--acc); font-weight:500; }
    .mono { font-family:'IBM Plex Mono', monospace; font-size:12px; }
    .ink-3 { color:var(--ink-3); }
    .modal-scrim { position:fixed; inset:0; background:rgba(28,27,25,.28); display:flex; align-items:center; justify-content:center; z-index:100; animation:fadeIn .16s; }
    .modal-card { background:var(--white); border-radius:12px; width:540px; max-width:90vw; max-height:90vh; overflow-y:auto; animation:slideIn .16s ease-out; }
    .wh-modal { width:600px; }
    .modal-head { display:flex; justify-content:space-between; align-items:center; padding:20px 24px; border-bottom:1px solid var(--line); }
    .modal-head h2 { font-size:16px; font-weight:600; color:var(--ink); margin:0; }
    .modal-close { background:none; border:none; font-size:20px; color:var(--ink-3); cursor:pointer; line-height:1; }
    .modal-body { padding:20px 24px; display:flex; flex-direction:column; gap:14px; }
    .modal-foot { display:flex; gap:10px; justify-content:flex-end; padding:16px 24px; border-top:1px solid var(--line); }
    .form-label { font-size:12px; font-weight:500; color:var(--ink-2); display:flex; flex-direction:column; gap:5px; }
    .form-input { background:var(--white); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:13px; color:var(--ink); width:100%; box-sizing:border-box; }
    .form-input:focus { outline:none; border-color:var(--acc); }
    .secret-row { display:flex; gap:8px; }
    .secret-row .form-input { flex:1; margin:0; }
    .evt-checks { display:flex; flex-direction:column; gap:5px; max-height:200px; overflow-y:auto; }
    .evt-check { display:flex; align-items:flex-start; gap:7px; cursor:pointer; padding:2px 0; }
    .evt-check input { margin-top:2px; flex-shrink:0; accent-color:var(--acc); }
    .evt-name { font-size:13px; color:var(--ink); font-family:'IBM Plex Mono', monospace; }
    .evt-desc { font-size:11.5px; color:var(--ink-3); }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
    @keyframes slideIn { from { transform:translateY(12px); opacity:0 } to { transform:translateY(0); opacity:1 } }
  `],
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
    { value: 'chat.created',          description: 'Nova conversa iniciada' },
    { value: 'chat.message.sent',     description: 'Mensagem enviada' },
    { value: 'chat.feedback.given',   description: 'Feedback dado' },
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
    this.http.get<Webhook[]>('/api/v1/admin/webhooks').subscribe({
      next: (data) => { this.webhooks.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void { this.editingWebhook.set(null); this.form = this.emptyForm(); this.showModal.set(true); }

  editWebhook(wh: Webhook): void { this.editingWebhook.set(wh); this.form = { ...wh, events: [...wh.events] }; this.showModal.set(true); }

  closeModal(): void { this.showModal.set(false); this.editingWebhook.set(null); }

  toggleEvent(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form.events = checked ? [...this.form.events, value] : this.form.events.filter((e) => e !== value);
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
      ? this.http.put(`/api/v1/admin/webhooks/${editing.id}`, this.form)
      : this.http.post('/api/v1/admin/webhooks', this.form);
    req$.subscribe({
      next: () => { this.loadWebhooks(); this.closeModal(); this.saving.set(false); },
      error: () => this.saving.set(false),
    });
  }

  testWebhook(wh: Webhook): void {
    this.testing.set(wh.id);
    this.http.post(`/api/v1/admin/webhooks/${wh.id}/test`, {}).subscribe({
      next: () => { this.testing.set(null); alert('Entrega de teste enviada!'); },
      error: () => { this.testing.set(null); alert('Falha ao enviar entrega de teste.'); },
    });
  }

  toggleStatus(wh: Webhook): void {
    const action = wh.status === 'active' ? 'pause' : 'activate';
    this.http.patch(`/api/v1/admin/webhooks/${wh.id}/${action}`, {}).subscribe(() => this.loadWebhooks());
  }

  deleteWebhook(wh: Webhook): void {
    if (!confirm(`Excluir webhook "${wh.name}"?`)) return;
    this.http.delete(`/api/v1/admin/webhooks/${wh.id}`).subscribe(() => this.loadWebhooks());
  }

  whKind(status: string): 'ok' | 'warn' | 'bad' | 'neutral' {
    return status === 'active' ? 'ok' : status === 'failing' ? 'bad' : 'warn';
  }

  whLabel(status: string): string {
    return { active: 'Ativo', paused: 'Pausado', failing: 'Falhando' }[status] ?? status;
  }

  private emptyForm(): Partial<Webhook> & { events: string[] } {
    return { name: '', url: '', secret: '', events: [], retryPolicy: '3x', timeoutMs: 5000 };
  }
}
