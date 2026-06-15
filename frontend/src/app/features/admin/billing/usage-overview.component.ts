import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UsageMetrics } from '../../../core/models/admin.model';
import { KpiCardComponent } from '../shared/kpi-card.component';
import { MiniBarComponent } from '../shared/mini-bar.component';

interface DailyUsage {
  date: string;
  messages: number;
  tokens: number;
  users: number;
  documents: number;
}

const MOCK_METRICS: UsageMetrics = {
  period: '30d', totalTokensInput: 1_840_000, totalTokensOutput: 920_000, totalTokensEmbedding: 320_000,
  totalChatRequests: 4_210, totalRagQueries: 1_870, totalDocumentsProcessed: 342,
  totalTrainingRuns: 3, gpuHoursInference: 124.5, gpuHoursTraining: 18.2, gpuHoursEmbedding: 6.8,
  storageDocumentsGb: 48.3, storageVectorDbGb: 12.1, storageModelsGb: 8.4,
  estimatedCost: { gpu: 1_240, storage: 180, network: 60, total: 1_480, currency: 'BRL' },
  byProject: [
    { projectId: '1', projectName: 'Atendimento', chatCount: 2_100, tokensUsed: 980_000, percentOfTotal: 49 },
    { projectId: '2', projectName: 'Jurídico',    chatCount: 1_200, tokensUsed: 620_000, percentOfTotal: 31 },
    { projectId: '3', projectName: 'RH',          chatCount: 910,  tokensUsed: 160_000, percentOfTotal: 20 },
  ],
  byUser: [
    { userId: 'u1', userName: 'Ana Lima',    chatCount: 820, tokensUsed: 390_000 },
    { userId: 'u2', userName: 'Carlos Melo', chatCount: 640, tokensUsed: 310_000 },
    { userId: 'u3', userName: 'Beatriz Sá',  chatCount: 510, tokensUsed: 210_000 },
  ],
  activeUsers: 87,
};

const BUDGET_LIMIT = 2_000;

@Component({
  selector: 'app-usage-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, KpiCardComponent, MiniBarComponent],
  template: `
    <div class="admin-page">
      <div class="breadcrumb">
        <a [routerLink]="['/admin/dashboard']" class="bc-link">Dashboard</a>
        <span class="bc-sep">/</span>
        <span>Uso &amp; Custos</span>
      </div>

      <div class="admin-header">
        <div>
          <h1>Uso &amp; Custos</h1>
          <p class="page-sub">Consumo detalhado por período, projeto e usuário</p>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedPeriod" (ngModelChange)="load()" class="period-select">
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
            <option value="90d">90 dias</option>
          </select>
          <button class="btn-ghost" (click)="exportCsv()">Exportar CSV</button>
        </div>
      </div>

      @if (budgetPct() >= 80) {
        <div class="budget-alert">
          Atenção: {{ budgetPct() | number:'1.0-0' }}% do orçamento mensal utilizado
          (R$ {{ metrics().estimatedCost.total | number:'1.0-0' }} / R$ {{ budgetLimit | number:'1.0-0' }})
        </div>
      }

      <div class="kpi-row">
        <app-kpi-card [value]="metrics().totalChatRequests | number" label="Conversas" />
        <app-kpi-card [value]="shortNumber(metrics().totalTokensInput + metrics().totalTokensOutput)" label="Tokens totais" />
        <app-kpi-card [value]="metrics().activeUsers" label="Usuários ativos" />
        <app-kpi-card [value]="'R$ ' + (metrics().estimatedCost.total | number:'1.0-0')" label="Custo estimado" />
      </div>

      <!-- Bar chart -->
      <div class="chart-card">
        <div class="chart-head">
          <h2>Uso ao longo do tempo</h2>
          <div class="chart-tabs">
            @for (tab of chartTabs; track tab.value) {
              <button class="chart-tab" [class.tab-active]="chartMetric() === tab.value"
                      (click)="chartMetric.set(tab.value)">{{ tab.label }}</button>
            }
          </div>
        </div>
        <div class="bar-chart">
          @if (dailyUsage().length > 0) {
            @for (day of dailyUsage(); track day.date; let last = $last) {
              <div class="bar-col">
                <div class="bar-wrap">
                  <div class="bar-fill"
                       [class.bar-last]="last"
                       [style.height.%]="getBarHeight(day)"
                       [title]="(getBarValue(day) | number) ?? ''"></div>
                </div>
                <span class="bar-label">{{ day.date | date:'dd/MM' }}</span>
              </div>
            }
          } @else {
            <div class="chart-empty">Nenhum dado para o período.</div>
          }
        </div>
      </div>

      <!-- Cost composition -->
      <div class="section-card">
        <h2 class="section-title">Composição de custo</h2>
        <div class="cost-bars">
          @for (item of costItems(); track item.label) {
            <div class="cost-item">
              <span class="cost-label">{{ item.label }}</span>
              <app-mini-bar [value]="item.value" [max]="metrics().estimatedCost.total" height="8px" [color]="item.color" />
              <span class="cost-value mono">R$ {{ item.value | number:'1.0-0' }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Tables row -->
      <div class="tables-row">
        <div class="section-card">
          <h2 class="section-title">Por projeto</h2>
          <div class="proj-grid">
            <div class="grid-head"><span>Projeto</span><span class="align-right">Chats</span><span class="align-right">Tokens</span><span>%</span></div>
            @for (p of metrics().byProject; track p.projectId) {
              <div class="grid-row">
                <span>{{ p.projectName }}</span>
                <span class="align-right mono">{{ p.chatCount | number }}</span>
                <span class="align-right mono">{{ shortNumber(p.tokensUsed) }}</span>
                <span class="pct-cell">
                  <app-mini-bar [value]="p.percentOfTotal" [max]="100" height="5px" />
                  <span class="mono ink-3">{{ p.percentOfTotal | number:'1.1-1' }}%</span>
                </span>
              </div>
            }
          </div>
        </div>

        <div class="section-card">
          <h2 class="section-title">Por usuário</h2>
          <div class="user-grid">
            <div class="grid-head"><span>Usuário</span><span class="align-right">Chats</span><span class="align-right">Tokens</span></div>
            @for (u of metrics().byUser; track u.userId) {
              <div class="grid-row">
                <span class="user-cell">
                  <span class="av-xs">{{ u.userName.slice(0,2).toUpperCase() }}</span>
                  {{ u.userName }}
                </span>
                <span class="align-right mono">{{ u.chatCount | number }}</span>
                <span class="align-right mono">{{ shortNumber(u.tokensUsed) }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Storage -->
      <div class="section-card">
        <h2 class="section-title">Storage</h2>
        <div class="cost-bars">
          <div class="cost-item">
            <span class="cost-label">Documentos</span>
            <app-mini-bar [value]="metrics().storageDocumentsGb" [max]="totalStorageGb()" height="8px" color="var(--acc)" />
            <span class="cost-value mono">{{ metrics().storageDocumentsGb | number:'1.1-1' }} GB</span>
          </div>
          <div class="cost-item">
            <span class="cost-label">Vector DB</span>
            <app-mini-bar [value]="metrics().storageVectorDbGb" [max]="totalStorageGb()" height="8px" color="var(--good)" />
            <span class="cost-value mono">{{ metrics().storageVectorDbGb | number:'1.1-1' }} GB</span>
          </div>
          <div class="cost-item">
            <span class="cost-label">Modelos LoRA</span>
            <app-mini-bar [value]="metrics().storageModelsGb" [max]="totalStorageGb()" height="8px" color="var(--warn)" />
            <span class="cost-value mono">{{ metrics().storageModelsGb | number:'1.1-1' }} GB</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { padding: 28px 32px; font-family: 'IBM Plex Sans', system-ui, sans-serif; max-width: 1200px; }
    .breadcrumb { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-3); margin-bottom:16px; }
    .bc-link { color:var(--ink-2); text-decoration:none; }
    .bc-link:hover { color:var(--ink); }
    .bc-sep { color:var(--line); }
    .admin-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .admin-header h1 { font-size:20px; font-weight:600; color:var(--ink); margin:0 0 4px; }
    .page-sub { font-size:13px; color:var(--ink-3); margin:0; }
    .header-actions { display:flex; gap:10px; align-items:center; }
    .period-select { background:var(--white); border:1px solid var(--line); border-radius:8px; padding:7px 12px; font-size:13px; color:var(--ink); }
    .btn-ghost { background:none; border:1px solid var(--line); border-radius:8px; padding:7px 16px; font-size:13px; color:var(--ink-2); cursor:pointer; }
    .btn-ghost:hover { background:var(--panel-2); }
    .budget-alert { background:#faf3e6; border:1px solid #ecd9b0; color:var(--warn); border-radius:8px; padding:10px 16px; font-size:13px; font-weight:500; margin-bottom:16px; }
    .kpi-row { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:16px; }
    .chart-card { background:var(--white); border:1px solid var(--line); border-radius:10px; padding:20px 24px; margin-bottom:12px; }
    .chart-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .chart-head h2 { font-size:14px; font-weight:600; color:var(--ink); margin:0; }
    .chart-tabs { display:flex; gap:6px; }
    .chart-tab { padding:5px 12px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--ink-2); font-size:12px; cursor:pointer; }
    .tab-active { background:var(--acc-soft); color:var(--acc); border-color:var(--acc-line); }
    .bar-chart { display:flex; align-items:flex-end; gap:3px; height:120px; padding-bottom:20px; }
    .bar-col { display:flex; flex-direction:column; align-items:center; flex:1; min-width:0; }
    .bar-wrap { flex:1; display:flex; align-items:flex-end; width:100%; }
    .bar-fill { width:100%; background:var(--line); border-radius:3px 3px 0 0; min-height:2px; transition:height .3s; }
    .bar-last { background:var(--acc); }
    .bar-label { font-size:10px; color:var(--ink-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; font-family:'IBM Plex Mono', monospace; }
    .chart-empty { text-align:center; padding:40px; color:var(--ink-3); font-size:13px; width:100%; }
    .section-card { background:var(--white); border:1px solid var(--line); border-radius:10px; padding:20px 24px; margin-bottom:12px; }
    .section-title { font-size:14px; font-weight:600; color:var(--ink); margin:0 0 16px; }
    .cost-bars { display:flex; flex-direction:column; gap:12px; }
    .cost-item { display:flex; align-items:center; gap:12px; }
    .cost-label { font-size:13px; color:var(--ink-2); min-width:100px; flex-shrink:0; }
    .cost-value { font-size:12px; color:var(--ink-3); min-width:70px; text-align:right; }
    app-mini-bar { flex:1; }
    .tables-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .proj-grid, .user-grid { display:grid; grid-template-columns:1fr auto auto 120px; gap:0; }
    .proj-grid { grid-template-columns:1fr 60px 80px 120px; }
    .user-grid { grid-template-columns:1fr 60px 80px; }
    .grid-head { display:contents; }
    .grid-head > span { padding:8px 10px; font-size:11px; font-weight:600; color:var(--ink-3); border-bottom:1px solid var(--line); }
    .grid-row { display:contents; }
    .grid-row > span { padding:9px 10px; font-size:12.5px; color:var(--ink); border-bottom:1px solid var(--line-2); }
    .grid-row:last-child > span { border-bottom:none; }
    .grid-row:hover > span { background:var(--panel-2); }
    .align-right { text-align:right; }
    .pct-cell { display:flex; align-items:center; gap:8px; padding-right:0 !important; }
    .user-cell { display:flex; align-items:center; gap:8px; }
    .av-xs { width:22px; height:22px; border-radius:50%; background:var(--acc-soft); color:var(--acc); font-size:9px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
    .mono { font-family:'IBM Plex Mono', monospace; }
    .ink-3 { color:var(--ink-3); }
  `],
})
export class UsageOverviewComponent implements OnInit {
  private http = inject(HttpClient);

  readonly budgetLimit = BUDGET_LIMIT;

  selectedPeriod = '30d';
  chartMetric    = signal<'messages' | 'tokens' | 'users' | 'documents'>('messages');
  metrics        = signal<UsageMetrics>(MOCK_METRICS);
  dailyUsage     = signal<DailyUsage[]>([]);

  budgetPct = computed(() => (this.metrics().estimatedCost.total / this.budgetLimit) * 100);

  costItems = computed(() => {
    const c = this.metrics().estimatedCost;
    return [
      { label: 'GPU / Inferência', value: c.gpu,     color: 'var(--acc)' },
      { label: 'Storage',          value: c.storage,  color: 'var(--warn)' },
      { label: 'Rede',             value: c.network,  color: 'var(--ink-3)' },
    ];
  });

  totalStorageGb = computed(() => {
    const m = this.metrics();
    return m.storageDocumentsGb + m.storageVectorDbGb + m.storageModelsGb || 1;
  });

  chartTabs: { value: 'messages' | 'tokens' | 'users' | 'documents'; label: string }[] = [
    { value: 'messages',  label: 'Mensagens' },
    { value: 'tokens',    label: 'Tokens' },
    { value: 'users',     label: 'Usuários' },
    { value: 'documents', label: 'Documentos' },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<UsageMetrics>(`/api/admin/metrics?period=${this.selectedPeriod}`).subscribe({
      next: (m) => this.metrics.set(m),
      error: () => this.metrics.set(MOCK_METRICS),
    });
    this.http.get<DailyUsage[]>(`/api/admin/metrics/daily?period=${this.selectedPeriod}`).subscribe({
      next: (d) => this.dailyUsage.set(d),
      error: () => this.dailyUsage.set([]),
    });
  }

  getBarValue(day: DailyUsage): number {
    const m = this.chartMetric();
    return m === 'messages' ? day.messages : m === 'tokens' ? day.tokens : m === 'users' ? day.users : day.documents;
  }

  getBarHeight(day: DailyUsage): number {
    const all = this.dailyUsage();
    const max = Math.max(...all.map((d) => this.getBarValue(d)), 1);
    return (this.getBarValue(day) / max) * 100;
  }

  exportCsv(): void {
    window.open(`/api/admin/metrics/export?period=${this.selectedPeriod}&format=csv`, '_blank');
  }

  shortNumber(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }
}
