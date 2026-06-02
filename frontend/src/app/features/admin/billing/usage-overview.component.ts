import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UsageMetrics } from '../../../core/models/admin.model';

interface DailyUsage {
  date: string;
  messages: number;
  tokens: number;
  users: number;
  documents: number;
}

@Component({
  selector: 'app-usage-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="usage-overview">
      <div class="page-header">
        <div>
          <h1>&#128202; Visão Geral de Uso</h1>
          <p>Consumo detalhado por período, projeto e usuário.</p>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedPeriod" (ngModelChange)="load()">
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
            <option value="90d">90 dias</option>
          </select>
          <button class="btn-secondary" (click)="exportCsv()">&#11015;&#65039; Exportar CSV</button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-icon">&#128172;</span>
          <span class="kpi-value">{{ metrics().totalChatRequests | number }}</span>
          <span class="kpi-label">Conversas</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-icon">&#128196;</span>
          <span class="kpi-value">{{ metrics().totalDocumentsProcessed | number }}</span>
          <span class="kpi-label">Documentos processados</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-icon">&#129302;</span>
          <span class="kpi-value">{{ shortNumber(metrics().totalTokensInput + metrics().totalTokensOutput) }}</span>
          <span class="kpi-label">Tokens totais</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-icon">&#128100;</span>
          <span class="kpi-value">{{ metrics().activeUsers }}</span>
          <span class="kpi-label">Usuários ativos</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-icon">&#127956;</span>
          <span class="kpi-value">{{ metrics().gpuHoursInference | number:'1.1-1' }}h</span>
          <span class="kpi-label">GPU Horas (inferência)</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-icon">&#128300;</span>
          <span class="kpi-value">{{ metrics().totalRagQueries | number }}</span>
          <span class="kpi-label">Consultas RAG</span>
        </div>
      </div>

      <!-- Gráfico de uso ao longo do tempo (barras visuais CSS) -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>Uso ao longo do tempo</h3>
          <div class="chart-tabs">
            @for (tab of chartTabs; track tab.value) {
              <button [class.active]="chartMetric() === tab.value" (click)="chartMetric.set(tab.value)">
                {{ tab.label }}
              </button>
            }
          </div>
        </div>
        <div class="bar-chart">
          @if (dailyUsage().length > 0) {
            @for (day of dailyUsage(); track day.date) {
              <div class="bar-col">
                <div class="bar-wrap">
                  <div class="bar-fill" [style.height.%]="getBarHeight(day)" [title]="getBarValue(day) | number"></div>
                </div>
                <span class="bar-label">{{ day.date | date:'dd/MM' }}</span>
              </div>
            }
          } @else {
            <div class="chart-empty">Nenhum dado disponível para o período.</div>
          }
        </div>
      </div>

      <!-- Por Projeto -->
      <div class="section-grid">
        <div class="table-card">
          <h3>&#128218; Por Projeto</h3>
          <table>
            <thead>
              <tr><th>Projeto</th><th>Chats</th><th>Tokens</th><th>% do total</th></tr>
            </thead>
            <tbody>
              @for (p of metrics().byProject; track p.projectId) {
                <tr>
                  <td>{{ p.projectName }}</td>
                  <td>{{ p.chatCount }}</td>
                  <td>{{ shortNumber(p.tokensUsed) }}</td>
                  <td>
                    <div class="percent-bar">
                      <div class="percent-fill" [style.width.%]="p.percentOfTotal"></div>
                    </div>
                    {{ p.percentOfTotal | number:'1.1-1' }}%
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="table-card">
          <h3>&#128100; Por Usuário</h3>
          <table>
            <thead>
              <tr><th>Usuário</th><th>Chats</th><th>Tokens</th></tr>
            </thead>
            <tbody>
              @for (u of metrics().byUser; track u.userId) {
                <tr>
                  <td><span class="avatar-xs">{{ u.userName.slice(0,2) }}</span> {{ u.userName }}</td>
                  <td>{{ u.chatCount }}</td>
                  <td>{{ shortNumber(u.tokensUsed) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Storage -->
      <div class="storage-section">
        <h3>&#128190; Storage</h3>
        <div class="storage-bars">
          <div class="storage-item">
            <span>Documentos</span>
            <div class="storage-bar"><div class="storage-fill docs" [style.width.%]="storagePercent('docs')"></div></div>
            <span>{{ metrics().storageDocumentsGb | number:'1.1-1' }} GB</span>
          </div>
          <div class="storage-item">
            <span>Vector DB</span>
            <div class="storage-bar"><div class="storage-fill vector" [style.width.%]="storagePercent('vector')"></div></div>
            <span>{{ metrics().storageVectorDbGb | number:'1.1-1' }} GB</span>
          </div>
          <div class="storage-item">
            <span>Modelos LoRA</span>
            <div class="storage-bar"><div class="storage-fill models" [style.width.%]="storagePercent('models')"></div></div>
            <span>{{ metrics().storageModelsGb | number:'1.1-1' }} GB</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; font-family: Inter, system-ui, sans-serif; }
    .usage-overview { padding: 28px 32px; background: #f8fafc; min-height: 100vh; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header h1 { font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .page-header p { font-size:13px; color:#64748b; margin:0; }
    .header-actions { display:flex; gap:10px; align-items:center; }
    .header-actions select { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:7px 12px; font-size:13px; color:#1e293b; }
    .btn-secondary { background:#f1f5f9; color:#374151; border:1px solid #e2e8f0; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; }
    .kpi-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:12px; margin-bottom:16px; }
    .kpi-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px; display:flex; flex-direction:column; align-items:center; gap:4px; }
    .kpi-icon { font-size:22px; }
    .kpi-value { font-size:22px; font-weight:700; color:#0f172a; }
    .kpi-label { font-size:12px; color:#64748b; text-align:center; }
    .chart-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; margin-bottom:16px; }
    .chart-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .chart-header h3 { font-size:15px; font-weight:600; color:#0f172a; margin:0; }
    .chart-tabs { display:flex; gap:6px; }
    .chart-tabs button { padding:5px 12px; border:1px solid #e2e8f0; border-radius:6px; background:#f1f5f9; color:#374151; font-size:12px; cursor:pointer; }
    .chart-tabs button.active { background:#6366f1; color:#fff; border-color:#6366f1; }
    .bar-chart { display:flex; align-items:flex-end; gap:4px; height:120px; padding-bottom:20px; position:relative; }
    .bar-col { display:flex; flex-direction:column; align-items:center; flex:1; min-width:0; }
    .bar-wrap { flex:1; display:flex; align-items:flex-end; width:100%; }
    .bar-fill { width:100%; background:#6366f1; border-radius:3px 3px 0 0; min-height:2px; transition:height 0.3s; }
    .bar-label { font-size:10px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
    .chart-empty { text-align:center; padding:40px; color:#94a3b8; font-size:14px; width:100%; }
    .section-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
    .table-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; }
    .table-card h3 { font-size:15px; font-weight:600; color:#0f172a; margin:0 0 16px; }
    .table-card table { width:100%; border-collapse:collapse; }
    .table-card th { padding:10px 16px; font-size:11px; font-weight:600; text-transform:uppercase; color:#94a3b8; background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left; }
    .table-card td { padding:11px 16px; font-size:13px; color:#374151; border-bottom:1px solid #f8fafc; }
    .table-card tr:hover td { background:#f8fafc; }
    .percent-bar { height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden; display:inline-block; width:60px; margin-right:8px; vertical-align:middle; }
    .percent-fill { height:100%; background:#6366f1; border-radius:3px; }
    .avatar-xs { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; background:#e0e7ff; color:#4338ca; font-size:10px; font-weight:600; margin-right:6px; }
    .storage-section { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; margin-bottom:16px; }
    .storage-section h3 { font-size:15px; font-weight:600; color:#0f172a; margin:0 0 16px; }
    .storage-bars { display:flex; flex-direction:column; gap:12px; }
    .storage-item { display:flex; align-items:center; gap:12px; font-size:13px; color:#374151; }
    .storage-item > span:first-child { width:100px; flex-shrink:0; }
    .storage-bar { flex:1; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden; }
    .storage-fill { height:100%; border-radius:4px; }
    .storage-fill.docs { background:#6366f1; }
    .storage-fill.vector { background:#10b981; }
    .storage-fill.models { background:#f59e0b; }
  `]
})
export class UsageOverviewComponent implements OnInit {
  private http = inject(HttpClient);

  selectedPeriod = '30d';
  chartMetric    = signal<'messages' | 'tokens' | 'users' | 'documents'>('messages');
  metrics        = signal<UsageMetrics>({
    period: '', totalTokensInput: 0, totalTokensOutput: 0, totalTokensEmbedding: 0,
    totalChatRequests: 0, totalRagQueries: 0, totalDocumentsProcessed: 0,
    totalTrainingRuns: 0, gpuHoursInference: 0, gpuHoursTraining: 0,
    gpuHoursEmbedding: 0, storageDocumentsGb: 0, storageVectorDbGb: 0,
    storageModelsGb: 0, estimatedCost: { gpu: 0, storage: 0, network: 0, total: 0, currency: 'BRL' },
    byProject: [], byUser: [], activeUsers: 0
  });
  dailyUsage = signal<DailyUsage[]>([]);

  chartTabs: { value: 'messages' | 'tokens' | 'users' | 'documents'; label: string }[] = [
    { value: 'messages',  label: 'Mensagens' },
    { value: 'tokens',    label: 'Tokens' },
    { value: 'users',     label: 'Usuários' },
    { value: 'documents', label: 'Documentos' },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<UsageMetrics>(`/api/admin/metrics?period=${this.selectedPeriod}`)
      .subscribe((m) => this.metrics.set(m));
    this.http.get<DailyUsage[]>(`/api/admin/metrics/daily?period=${this.selectedPeriod}`)
      .subscribe((d) => this.dailyUsage.set(d));
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

  storagePercent(type: 'docs' | 'vector' | 'models'): number {
    const m = this.metrics();
    const total = (m.storageDocumentsGb + m.storageVectorDbGb + m.storageModelsGb) || 1;
    const v = type === 'docs' ? m.storageDocumentsGb : type === 'vector' ? m.storageVectorDbGb : m.storageModelsGb;
    return (v / total) * 100;
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
