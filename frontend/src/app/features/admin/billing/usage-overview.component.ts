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
  `
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

  chartTabs = [
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
