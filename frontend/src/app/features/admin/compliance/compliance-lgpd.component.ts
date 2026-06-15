import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GaugeComponent } from '../shared/gauge.component';
import { StatusPillComponent } from '../shared/status-pill.component';
import { EmptyStateComponent } from '../shared/empty-state.component';

interface ComplianceControl {
  id: string;
  name: string;
  status: 'ok' | 'partial' | 'pending';
  note: string;
  resolveRoute?: string;
  resolveParams?: Record<string, string>;
}

interface DsarRequest {
  id: string;
  subjectRef: string;
  type: 'deletion' | 'export';
  dueAt: string;
  status: 'pending' | 'progress' | 'done';
}

interface ComplianceState {
  scorePct: number;
  controls: ComplianceControl[];
  dsar: DsarRequest[];
}

const MOCK: ComplianceState = {
  scorePct: 92,
  controls: [
    { id: 'mfa',        name: 'MFA habilitado para todos os usuários', status: 'partial', note: '3 usuários sem MFA', resolveRoute: '/admin/users', resolveParams: { filter: 'no-mfa' } },
    { id: 'audit',      name: 'Logs de auditoria retidos por ≥365 dias', status: 'ok',      note: 'Conforme' },
    { id: 'retention',  name: 'Política de retenção de dados configurada', status: 'ok',   note: 'Conforme' },
    { id: 'access',     name: 'Revisão de acessos nos últimos 90 dias',   status: 'ok',   note: 'Revisado em 15/05/2026' },
    { id: 'sso',        name: 'Login único (SSO) configurado',             status: 'ok',   note: 'Google + Microsoft' },
    { id: 'dsar-sla',   name: 'DSAR respondidos em até 15 dias',          status: 'pending', note: '1 solicitação pendente' },
  ],
  dsar: [
    { id: 'd1', subjectRef: 'user@example.com', type: 'deletion', dueAt: '2026-06-20T00:00:00Z', status: 'pending' },
    { id: 'd2', subjectRef: 'another@corp.io',  type: 'export',   dueAt: '2026-06-18T00:00:00Z', status: 'progress' },
    { id: 'd3', subjectRef: 'done@corp.io',     type: 'deletion', dueAt: '2026-06-01T00:00:00Z', status: 'done' },
  ],
};

@Component({
  selector: 'app-compliance-lgpd',
  standalone: true,
  imports: [CommonModule, RouterLink, GaugeComponent, StatusPillComponent, EmptyStateComponent, DatePipe],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <a routerLink="/admin/dashboard" class="breadcrumb-back">← Visão geral</a>
          <h1>Compliance LGPD</h1>
          <p class="subtitle">Painel de conformidade, controles e solicitações de titulares (DSAR)</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost" (click)="exportReport()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Exportar relatório
          </button>
        </div>
      </div>

      <div class="page-body">

        @if (loading()) {
          <div class="loading-bar"></div>
        }

        <!-- Score + Controls -->
        <div class="top-grid">
          <!-- Score card -->
          <div class="score-card">
            <app-gauge [value]="state()?.scorePct ?? 0"
                       sub="Score de conformidade"
                       [color]="scoreColor()"/>
            <div class="score-meta">
              <p class="score-label">Score de conformidade</p>
              @if (pendingControlsCount() > 0) {
                <p class="score-issues">{{ pendingControlsCount() }} {{ pendingControlsCount() === 1 ? 'item precisa' : 'itens precisam' }} de atenção</p>
              } @else {
                <p class="score-ok">Todos os controles conformes</p>
              }
            </div>
          </div>

          <!-- Controls list -->
          <div class="controls-card">
            <p class="sec-head">Controles</p>
            <div class="controls-list">
              @for (ctrl of state()?.controls ?? []; track ctrl.id) {
                <div class="control-row">
                  <span class="ctrl-seal" [class]="'ctrl-' + ctrl.status" aria-label="Status: {{ ctrl.status }}">
                    {{ ctrl.status === 'ok' ? '✓' : ctrl.status === 'partial' ? '!' : '○' }}
                  </span>
                  <div class="ctrl-body">
                    <span class="ctrl-name">{{ ctrl.name }}</span>
                    <span class="ctrl-note">{{ ctrl.note }}</span>
                  </div>
                  @if (ctrl.status !== 'ok' && ctrl.resolveRoute) {
                    <a [routerLink]="ctrl.resolveRoute"
                       [queryParams]="ctrl.resolveParams"
                       class="btn btn-ghost btn-sm ctrl-resolve">
                      Resolver
                    </a>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- DSAR -->
        <div class="dsar-section">
          <div class="dsar-header">
            <p class="sec-head">Solicitações de titulares (DSAR)</p>
          </div>

          @if ((state()?.dsar ?? []).length === 0) {
            <app-empty-state icon="✅" title="Nenhuma solicitação pendente" description="Todas as DSARs foram resolvidas."/>
          } @else {
            <div class="dsar-table">
              <!-- Header -->
              <div class="dsar-row dsar-head">
                <span class="dt-cell">Titular</span>
                <span class="dt-cell">Tipo</span>
                <span class="dt-cell">Prazo</span>
                <span class="dt-cell">Status</span>
                <span class="dt-cell"></span>
              </div>
              @for (req of state()?.dsar ?? []; track req.id) {
                <div class="dsar-row">
                  <span class="dt-cell mono dsar-subject">{{ req.subjectRef }}</span>
                  <span class="dt-cell">
                    <span class="type-chip">{{ req.type === 'deletion' ? 'Exclusão' : 'Exportação' }}</span>
                  </span>
                  <span class="dt-cell mono" [class.due-overdue]="isDueOverdue(req)">
                    {{ req.dueAt | date:'dd/MM/yyyy' }}
                  </span>
                  <span class="dt-cell">
                    <app-status-pill [kind]="dsarPillKind(req.status)">
                      {{ dsarStatusLabel(req.status) }}
                    </app-status-pill>
                  </span>
                  <span class="dt-cell">
                    @if (req.status !== 'done') {
                      <button class="btn btn-ghost btn-sm" (click)="resolveDsar(req)">
                        Concluir
                      </button>
                    }
                  </span>
                </div>
              }
            </div>
          }
        </div>

      </div>
    </div>

    <!-- Confirm modal -->
    @if (confirmDsar()) {
      <div class="modal-scrim" (click)="confirmDsar.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <h3>Concluir DSAR</h3>
          <p>Marcar a solicitação de <strong>{{ confirmDsar()!.subjectRef }}</strong> como concluída? Esta ação será registrada na auditoria.</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" (click)="confirmDsar.set(null)">Cancelar</button>
            <button class="btn btn-accent" (click)="confirmResolveDsar()">Confirmar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; font-family: 'IBM Plex Sans', system-ui, sans-serif; }

    .page { background: var(--white); min-height: 100vh; }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 28px 16px;
      border-bottom: 1px solid var(--line);
      background: var(--white);
    }
    .page-header-left { display: flex; flex-direction: column; gap: 3px; }
    .breadcrumb-back {
      font-size: 12.5px;
      color: var(--ink-3);
      text-decoration: none;
      &:hover { color: var(--acc); }
    }
    h1 { font-size: 19px; font-weight: 600; color: var(--ink); margin: 0; letter-spacing: -0.01em; }
    .subtitle { font-size: 13px; color: var(--ink-3); margin: 0; }
    .header-actions { display: flex; gap: 8px; align-items: center; }

    .page-body { padding: 20px 28px 40px; max-width: 1000px; margin: 0 auto; }

    .loading-bar {
      height: 3px;
      background: linear-gradient(90deg, var(--acc-soft) 0%, var(--acc) 50%, var(--acc-soft) 100%);
      background-size: 200% 100%;
      animation: slide 1.5s linear infinite;
      margin-bottom: 16px;
      border-radius: 2px;
    }
    @keyframes slide { from { background-position: 200% 0; } to { background-position: -200% 0; } }

    /* Score + Controls grid */
    .top-grid {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    .score-card {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .score-meta { text-align: center; }
    .score-label { font-size: 13.5px; font-weight: 600; color: var(--ink); margin: 0 0 4px; }
    .score-issues { font-size: 12.5px; color: var(--warn); margin: 0; }
    .score-ok { font-size: 12.5px; color: var(--good); margin: 0; }

    .controls-card {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .sec-head { font-size: 15px; font-weight: 600; color: var(--ink); margin: 0 0 14px; }

    .controls-list { display: flex; flex-direction: column; gap: 0; }
    .control-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-top: 1px solid var(--line-2);
      &:first-child { border-top: none; }
    }
    .ctrl-seal {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .ctrl-ok      { background: var(--good-soft); color: var(--good); }
    .ctrl-partial { background: #faf3e6; color: var(--warn); }
    .ctrl-pending { background: var(--acc-soft); color: var(--acc); }

    .ctrl-body { flex: 1; min-width: 0; }
    .ctrl-name { display: block; font-size: 13px; font-weight: 560; color: var(--ink); }
    .ctrl-note { display: block; font-size: 11.5px; color: var(--ink-3); margin-top: 1px; }
    .ctrl-resolve { flex-shrink: 0; }

    /* DSAR */
    .dsar-section {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    .dsar-header { padding: 16px 18px 0; }

    .dsar-table { display: flex; flex-direction: column; }
    .dsar-row {
      display: grid;
      grid-template-columns: 1fr 130px 120px 130px 80px;
      padding: 0 18px;
      border-top: 1px solid var(--line-2);
    }
    .dsar-head {
      background: var(--panel);
      border-top: 1px solid var(--line);
      border-bottom: none;
    }
    .dsar-head .dt-cell {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--ink-3);
      padding: 10px 8px;
    }
    .dt-cell { display: flex; align-items: center; padding: 11px 8px; font-size: 13px; color: var(--ink-2); }
    .dsar-subject { color: var(--ink); font-size: 12.5px; }
    .due-overdue { color: var(--acc) !important; }
    .type-chip {
      display: inline-flex;
      padding: 2px 8px;
      border-radius: 7px;
      font-size: 11.5px;
      font-weight: 500;
      background: var(--panel-2);
      color: var(--ink-2);
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.12s, color 0.12s;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      white-space: nowrap;
      text-decoration: none;
      min-height: 36px;
    }
    .btn-ghost { background: transparent; color: var(--ink-2); border-color: var(--line); &:hover { background: var(--panel-2); color: var(--ink); } }
    .btn-accent { background: var(--acc); color: #fff; border-color: var(--acc); &:hover { background: #a84d32; } }
    .btn-sm { padding: 4px 10px; font-size: 12px; min-height: 28px; border-radius: 7px; }

    /* Modal */
    .modal-scrim { position: fixed; inset: 0; background: rgba(28,27,25,.28); display: flex; align-items: center; justify-content: center; z-index: 200; }
    .modal-card { background: var(--white); border: 1px solid var(--line); border-radius: 14px; padding: 28px 32px; max-width: 420px; width: 90%; box-shadow: 0 8px 40px rgba(28,27,25,.14); }
    .modal-card h3 { font-size: 16px; font-weight: 600; color: var(--ink); margin: 0 0 8px; }
    .modal-card p { font-size: 13.5px; color: var(--ink-2); line-height: 1.55; margin: 0 0 20px; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

    .mono { font-family: 'IBM Plex Mono', monospace; }
  `]
})
export class ComplianceLgpdComponent implements OnInit {
  private http = inject(HttpClient);

  loading = signal(false);
  state = signal<ComplianceState | null>(null);
  confirmDsar = signal<DsarRequest | null>(null);

  pendingControlsCount = computed(() =>
    (this.state()?.controls ?? []).filter(c => c.status !== 'ok').length
  );

  scoreColor = computed(() => {
    const s = this.state()?.scorePct ?? 0;
    return s >= 90 ? 'var(--good)' : s >= 70 ? 'var(--warn)' : 'var(--acc)';
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.http.get<ComplianceState>('/api/admin/compliance').subscribe({
      next: (data) => { this.state.set(data); this.loading.set(false); },
      error: () => { this.state.set(MOCK); this.loading.set(false); },
    });
  }

  isDueOverdue(req: DsarRequest): boolean {
    return req.status !== 'done' && new Date(req.dueAt) <= new Date();
  }

  dsarPillKind(status: DsarRequest['status']): 'ok' | 'warn' | 'bad' | 'neutral' {
    return status === 'done' ? 'ok' : status === 'progress' ? 'warn' : 'bad';
  }

  dsarStatusLabel(status: DsarRequest['status']): string {
    return { pending: 'Pendente', progress: 'Em andamento', done: 'Concluído' }[status];
  }

  resolveDsar(req: DsarRequest): void { this.confirmDsar.set(req); }

  confirmResolveDsar(): void {
    const req = this.confirmDsar();
    if (!req) return;
    this.http.post(`/api/admin/compliance/dsar/${req.id}/resolve`, {}).subscribe({
      next: () => { this.confirmDsar.set(null); this.load(); },
      error: () => this.confirmDsar.set(null),
    });
  }

  exportReport(): void {
    window.open('/api/admin/compliance/report.pdf', '_blank');
  }
}
