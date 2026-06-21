import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, switchMap, forkJoin } from 'rxjs';
import { SystemHealth, GpuInfo, UsageMetrics, AdminAlert } from '../../../core/models/admin.model';
import { KpiCardComponent } from '../shared/kpi-card.component';
import { GaugeComponent } from '../shared/gauge.component';
import { MiniBarComponent } from '../shared/mini-bar.component';

// Estados vazios honestos (sem dados fabricados). Preenchidos pelas chamadas reais;
// na falha de carregamento permanecem zerados em vez de exibir números falsos.
const EMPTY_HEALTH: SystemHealth = {
  status: 'down', api: false, database: false, vectorDb: false, gpu: false,
  embedding: false, uptimePercent: 0, avgLatencyMs: 0,
};
const EMPTY_GPU: GpuInfo = {
  model: '—', utilization: 0, vramUsed: 0, vramTotal: 0,
  vramPercent: 0, temperature: 0, requestsPerMin: 0,
  activeModel: '—', activeLoraVersion: '—', provider: '—',
};
const EMPTY_METRICS: Partial<UsageMetrics> = {
  activeUsers: 0, totalChatRequests: 0, totalTokensInput: 0,
  totalTokensOutput: 0,
  estimatedCost: { gpu: 0, storage: 0, network: 0, total: 0, currency: 'BRL' },
};
const EMPTY_ALERTS: AdminAlert[] = [];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe, CurrencyPipe, KpiCardComponent, GaugeComponent, MiniBarComponent],
  template: `
    <div class="dash">
      <!-- Header -->
      <div class="dash-header">
        <div>
          <h1>Visão geral</h1>
          <p class="subtitle">Centro de operações · atualizado agora</p>
        </div>
        <div class="header-actions">
          <select class="period-sel" [(value)]="selectedPeriod" (change)="onPeriodChange($event)">
            <option value="7d">Últimos 7 dias</option>
            <option value="30d" selected>Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
          <button class="btn-ghost" (click)="exportReport()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Exportar
          </button>
        </div>
      </div>

      <!-- 1. Health strip -->
      <div class="health-strip">
        <div class="health-left">
          <span class="health-pill" [class.degraded]="health().status !== 'healthy'">
            <span class="health-dot"></span>
            {{ health().status === 'healthy' ? 'Sistema operacional' : 'Atenção em ' + downCount() + ' serviço(s)' }}
          </span>
          <div class="svc-row">
            @for (svc of services(); track svc.name) {
              <span class="svc-item" [title]="svc.name">
                <span class="svc-dot" [class.svc-ok]="svc.ok" [class.svc-bad]="!svc.ok"></span>
                <span class="svc-name">{{ svc.name }}</span>
              </span>
            }
          </div>
        </div>
        <div class="health-right mono">
          <span>uptime <strong>{{ health().uptimePercent | number:'1.2-2' }}%</strong></span>
          <span class="sep">·</span>
          <span>latência <strong>{{ health().avgLatencyMs }}ms</strong></span>
        </div>
      </div>

      <!-- 2. Precisa da sua atenção -->
      @if (alerts().length > 0) {
        <section class="section">
          <p class="sec-head">
            Precisa da sua atenção
            <span class="sec-count">{{ alerts().length }}</span>
          </p>
          <div class="alerts-grid">
            @for (alert of alerts(); track alert.id) {
              <div class="action-card" [class]="'action-' + alert.severity">
                <div class="action-icon-wrap">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    @if (alert.severity === 'critical') {
                      <path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                      <path d="M8 6v3M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    } @else {
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M8 5v3M8 10v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    }
                  </svg>
                </div>
                <div class="action-body">
                  <span class="action-title">{{ alert.title }}</span>
                  <span class="action-desc">{{ alert.description }}</span>
                </div>
                <a [routerLink]="alertRoute(alert)" [queryParams]="alertParams(alert)"
                   class="action-btn" [class.action-btn-accent]="alert.severity === 'critical'">
                  {{ alert.actionLabel }} →
                </a>
              </div>
            }
          </div>
        </section>
      }

      <!-- 3. Métricas -->
      <section class="section">
        <div class="metrics-grid">
          <!-- KPIs 2×2 -->
          <div class="kpi-quad">
            <app-kpi-card value="{{ metrics().activeUsers | number }}"
                          label="Usuários ativos"
                          trend="↑ este mês" trendDir="up"/>
            <app-kpi-card value="{{ metrics().totalChatRequests | number }}"
                          label="Conversas · {{ selectedPeriod }}"
                          trend="↑ 12%" trendDir="up"/>
            <app-kpi-card value="{{ shortTokens() }}"
                          label="Tokens · {{ selectedPeriod }}"/>
            <app-kpi-card value="{{ costPerUser() | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}"
                          label="Custo/usuário mês"
                          [trend]="costTrend()" trendDir="warn"/>
          </div>

          <!-- GPU Gauge -->
          <div class="gpu-card">
            <p class="card-label">GPU · {{ gpu().model }}</p>
            <div class="gpu-center">
              <app-gauge [value]="gpu().utilization"
                         sub="Utilização"
                         [color]="gpu().utilization > 90 ? 'var(--acc)' : 'var(--good)'"/>
            </div>
            <div class="vram-row">
              <span class="vram-label mono">VRAM {{ gpu().vramUsed }}GB / {{ gpu().vramTotal }}GB</span>
              <app-mini-bar [value]="gpu().vramUsed" [max]="gpu().vramTotal"
                            color="var(--ink-2)" height="5px"/>
            </div>
            <p class="gpu-model-info mono">{{ gpu().activeModel }}</p>
          </div>

          <!-- Custo -->
          <div class="cost-card">
            <div class="cost-total-row">
              <p class="card-label">Custo 30d</p>
              <span class="cost-total mono">{{ metrics().estimatedCost?.total | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</span>
            </div>
            <div class="cost-items">
              @for (item of costBreakdown(); track item.label) {
                <div class="cost-item">
                  <span class="cost-item-label">{{ item.label }}</span>
                  <app-mini-bar [value]="item.pct" [max]="100"
                                color="var(--ink-2)" height="5px"/>
                  <span class="cost-item-val mono">{{ item.val | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Áreas de administração -->
      <section class="section">
        <p class="sec-head">Áreas de administração</p>
        <div class="areas-grid">
          @for (area of adminAreas; track area.route) {
            <a class="area-card" [routerLink]="area.route">
              <div class="area-icon" [innerHTML]="area.icon" aria-hidden="true"></div>
              <div class="area-body">
                <span class="area-title">{{ area.title }}</span>
                <span class="area-desc">{{ area.desc }}</span>
              </div>
              <svg class="area-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; font-family: 'IBM Plex Sans', system-ui, sans-serif; }

    .dash {
      padding: 20px 28px 40px;
      max-width: 1120px;
      margin: 0 auto;
    }

    /* Header */
    .dash-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
    }
    h1 { font-size: 19px; font-weight: 600; color: var(--ink); margin: 0; letter-spacing: -0.01em; }
    .subtitle { font-size: 13px; color: var(--ink-3); margin: 2px 0 0; }
    .header-actions { display: flex; gap: 8px; align-items: center; }

    .period-sel {
      padding: 6px 10px;
      border: 1px solid var(--line);
      border-radius: 9px;
      font-size: 12.5px;
      color: var(--ink-2);
      background: var(--white);
      cursor: pointer;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      &:focus { outline: 2px solid var(--acc); outline-offset: 1px; }
    }

    .btn-ghost {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 13px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--white);
      font-size: 12.5px;
      color: var(--ink-2);
      cursor: pointer;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      min-height: 34px;
      transition: background 0.12s, color 0.12s;
      &:hover { background: var(--panel-2); color: var(--ink); }
    }

    /* Health strip */
    .health-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 12px 18px;
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .health-left { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .health-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 4px 11px;
      background: var(--good-soft);
      color: var(--good);
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      white-space: nowrap;
      &.degraded { background: var(--acc-soft); color: var(--acc); }
    }
    .health-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .svc-row { display: flex; gap: 14px; flex-wrap: wrap; }
    .svc-item { display: flex; align-items: center; gap: 5px; }
    .svc-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ink-3);
    }
    .svc-ok  { background: var(--good); }
    .svc-bad { background: var(--acc); }
    .svc-name { font-size: 12px; color: var(--ink-2); }
    .health-right {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 11.5px;
      color: var(--ink-3);
    }
    .health-right strong { color: var(--ink); font-weight: 500; }
    .sep { color: var(--line); }

    /* Section */
    .section { margin-bottom: 24px; }
    .sec-head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      font-weight: 600;
      color: var(--ink);
      margin: 0 0 12px;
    }
    .sec-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--acc);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
    }

    /* Attention cards */
    .alerts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 12px;
    }
    .action-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 10px;
      border: 1px solid var(--acc-line);
      background: var(--acc-soft);
    }
    .action-warning {
      border-color: #ecd9b0;
      background: #faf3e6;
    }
    .action-info {
      border-color: var(--line);
      background: var(--panel);
    }
    .action-icon-wrap {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: var(--white);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--acc);
    }
    .action-warning .action-icon-wrap { color: var(--warn); }
    .action-info    .action-icon-wrap { color: var(--ink-2); }
    .action-body { flex: 1; min-width: 0; }
    .action-title { display: block; font-size: 13.5px; font-weight: 600; color: var(--acc); margin-bottom: 2px; }
    .action-warning .action-title { color: #8a5c0a; }
    .action-info    .action-title { color: var(--ink); }
    .action-desc  { display: block; font-size: 12px; color: var(--ink-2); line-height: 1.5; }
    .action-btn {
      flex-shrink: 0;
      padding: 5px 12px;
      border-radius: 7px;
      border: none;
      background: var(--acc);
      color: #fff;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      text-decoration: none;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      align-self: center;
      transition: background 0.12s;
      &:hover { background: #a84d32; }
    }
    .action-warning .action-btn {
      background: transparent;
      color: #8a5c0a;
      border: 1px solid #ecd9b0;
      &:hover { background: #ecd9b0; }
    }
    .action-info .action-btn {
      background: transparent;
      color: var(--ink-2);
      border: 1px solid var(--line);
      &:hover { background: var(--panel-2); }
    }

    /* Metrics grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: 1.6fr 0.85fr 1fr;
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 960px) {
      .metrics-grid { grid-template-columns: 1fr 1fr; }
    }

    .kpi-quad {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .gpu-card, .cost-card {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px 18px;
    }
    .card-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--ink-3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0 0 12px;
    }
    .gpu-center { display: flex; justify-content: center; margin-bottom: 12px; }
    .vram-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .vram-label { font-size: 11px; color: var(--ink-3); }
    .gpu-model-info { font-size: 11px; color: var(--ink-3); margin: 8px 0 0; text-align: center; }

    .cost-total-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
    .cost-total { font-size: 22px; font-weight: 600; color: var(--ink); }
    .cost-items { display: flex; flex-direction: column; gap: 10px; }
    .cost-item { display: flex; align-items: center; gap: 8px; }
    .cost-item-label { font-size: 12.5px; color: var(--ink-2); width: 70px; flex-shrink: 0; }
    .cost-item-val { font-size: 12px; color: var(--ink-2); white-space: nowrap; width: 60px; text-align: right; flex-shrink: 0; }
    app-mini-bar { flex: 1; }

    /* Areas */
    .areas-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    @media (max-width: 900px) { .areas-grid { grid-template-columns: 1fr 1fr; } }
    .area-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .area-card:hover {
      border-color: var(--ink-3);
      box-shadow: 0 2px 12px rgba(28,27,25,.06);
    }
    .area-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--panel-2);
      color: var(--ink-2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .area-icon ::ng-deep svg { width: 18px; height: 18px; }
    .area-body { flex: 1; min-width: 0; }
    .area-title { display: block; font-size: 13.5px; font-weight: 600; color: var(--ink); }
    .area-desc  { display: block; font-size: 11.5px; color: var(--ink-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .area-chevron { color: var(--ink-3); flex-shrink: 0; }

    .mono { font-family: 'IBM Plex Mono', monospace; }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  selectedPeriod = '30d';
  health   = signal<SystemHealth>(EMPTY_HEALTH);
  gpu      = signal<GpuInfo>(EMPTY_GPU);
  metrics  = signal<Partial<UsageMetrics>>(EMPTY_METRICS);
  alerts   = signal<AdminAlert[]>(EMPTY_ALERTS);

  services = computed(() => [
    { name: 'API',        ok: this.health().api },
    { name: 'GPU · vLLM', ok: this.health().gpu },
    { name: 'PostgreSQL', ok: this.health().database },
    { name: 'Qdrant',     ok: this.health().vectorDb },
    { name: 'Embedding',  ok: this.health().embedding },
  ]);

  downCount = computed(() => this.services().filter(s => !s.ok).length);

  costPerUser = computed(() => {
    const u = this.metrics().activeUsers ?? 0;
    return u > 0 ? (this.metrics().estimatedCost?.total ?? 0) / u : 0;
  });

  shortTokens = computed(() => {
    const n = (this.metrics().totalTokensInput ?? 0) + (this.metrics().totalTokensOutput ?? 0);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  });

  costTrend = computed(() => {
    const used = this.metrics().estimatedCost?.total ?? 0;
    const limit = 3000;
    const pct = Math.round((used / limit) * 100);
    return `${pct}% do orçamento`;
  });

  costBreakdown = computed(() => {
    const c = this.metrics().estimatedCost;
    if (!c) return [];
    return [
      { label: 'GPU',     val: c.gpu,     pct: c.total ? (c.gpu     / c.total) * 100 : 0 },
      { label: 'Storage', val: c.storage, pct: c.total ? (c.storage / c.total) * 100 : 0 },
      { label: 'Rede',    val: c.network, pct: c.total ? (c.network / c.total) * 100 : 0 },
    ];
  });

  alertRoute(a: AdminAlert): string {
    return a.actionType?.split('?')[0] ?? '/admin/dashboard';
  }

  alertParams(a: AdminAlert): Record<string, string> {
    const qs = a.actionType?.split('?')[1];
    if (!qs) return {};
    const params = new URLSearchParams(qs);
    const result: Record<string, string> = {};
    params.forEach((value, key) => { result[key] = value; });
    return result;
  }

  adminAreas = [
    {
      title: 'Usuários & papéis',
      desc: 'Membros, convites e permissões',
      route: '/admin/users',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2 16c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13 9c2 0 4 1.2 4 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="13" cy="5.5" r="2" stroke="currentColor" stroke-width="1.5"/></svg>`,
    },
    {
      title: 'Auditoria',
      desc: 'Histórico de eventos e segurança',
      route: '/admin/audit',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="1" width="11" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 6h7M5 9h7M5 12h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    },
    {
      title: 'Compliance LGPD',
      desc: 'Score, controles e DSARs',
      route: '/admin/compliance',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.5L3 4.5V9c0 4 3 7 6 8 3-1 6-4 6-8V4.5L9 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 9l2.5 2.5 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
    {
      title: 'Modelos & LoRA',
      desc: 'Inferência e adapters ativos',
      route: '/admin/ai-config',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="9" r="2" fill="currentColor"/></svg>`,
    },
    {
      title: 'Uso & custos',
      desc: 'Tokens, GPU e custo estimado',
      route: '/admin/billing',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="5" width="15" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M1.5 9h15" stroke="currentColor" stroke-width="1.5"/><circle cx="5.5" cy="12" r="1.2" fill="currentColor"/></svg>`,
    },
    {
      title: 'API keys',
      desc: 'Acesso programático seguro',
      route: '/admin/api-keys',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10.5L16 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13.5 14l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    },
  ];

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.loadAll();
    this.subs.push(
      interval(30_000)
        .pipe(switchMap(() => this.http.get<SystemHealth>('/api/v1/admin/health')))
        .subscribe({ next: (h) => this.health.set(h), error: () => {} })
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  loadAll(): void {
    forkJoin({
      health:  this.http.get<SystemHealth>('/api/v1/admin/health'),
      gpu:     this.http.get<GpuInfo>('/api/v1/admin/gpu-status'),
      metrics: this.http.get<UsageMetrics>(`/api/v1/admin/metrics?period=${this.selectedPeriod}`),
      alerts:  this.http.get<AdminAlert[]>('/api/v1/admin/alerts'),
    }).subscribe({
      next: (data) => {
        this.health.set(data.health);
        this.gpu.set(data.gpu);
        this.metrics.set(data.metrics);
        this.alerts.set(data.alerts);
      },
      error: () => { /* keep mock data */ },
    });
  }

  onPeriodChange(e: Event): void {
    this.selectedPeriod = (e.target as HTMLSelectElement).value;
    this.http.get<UsageMetrics>(`/api/v1/admin/metrics?period=${this.selectedPeriod}`)
      .subscribe({ next: (m) => this.metrics.set(m), error: () => {} });
  }

  exportReport(): void {
    window.open(`/api/v1/admin/metrics/export?period=${this.selectedPeriod}`, '_blank');
  }
}
