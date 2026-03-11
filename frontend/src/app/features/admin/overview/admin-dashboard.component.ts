import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, interval, Subscription, switchMap } from 'rxjs';
import { SystemHealth, GpuInfo, UsageMetrics, AdminAlert } from '../../../core/models/admin.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="admin-dashboard">
      <div class="dashboard-header">
        <div>
          <h1>&#128101; Administração</h1>
          <p class="subtitle">{{ workspaceName() }} &mdash; <span class="plan-badge">Enterprise</span></p>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedPeriod" (ngModelChange)="loadMetrics()">
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
          <button class="btn-secondary" (click)="exportReport()">&#11015;&#65039; Exportar Relatório</button>
        </div>
      </div>

      <!-- Status Cards -->
      <div class="status-grid">

        <!-- Saúde do Sistema -->
        <div class="status-card" [class]="systemHealth().status">
          <div class="status-header">
            <span class="status-dot"></span>
            <span class="status-label">Sistema</span>
          </div>
          <div class="status-body">
            <span class="status-title">
              {{ systemHealth().status === 'healthy' ? '✅ Operacional' : systemHealth().status === 'degraded' ? '⚠️ Degradado' : '🔴 Indisponível' }}
            </span>
            <div class="health-items">
              <div class="health-item"><span class="health-dot" [class.ok]="systemHealth().api" [class.err]="!systemHealth().api"></span> API</div>
              <div class="health-item"><span class="health-dot" [class.ok]="systemHealth().gpu" [class.err]="!systemHealth().gpu"></span> GPU Inferência</div>
              <div class="health-item"><span class="health-dot" [class.ok]="systemHealth().database" [class.err]="!systemHealth().database"></span> Banco de Dados</div>
              <div class="health-item"><span class="health-dot" [class.ok]="systemHealth().vectorDb" [class.err]="!systemHealth().vectorDb"></span> Vector DB (Qdrant)</div>
              <div class="health-item"><span class="health-dot" [class.ok]="systemHealth().embedding" [class.err]="!systemHealth().embedding"></span> Embedding Service</div>
            </div>
          </div>
          <div class="status-footer">
            <span>Uptime {{ systemHealth().uptimePercent | number:'1.2-2' }}%</span>
            <span>Latência {{ systemHealth().avgLatencyMs }}ms</span>
          </div>
        </div>

        <!-- GPU -->
        <div class="status-card gpu-card">
          <div class="status-header">
            <span class="status-label">&#127956; GPU</span>
            <span class="gpu-model">{{ gpuInfo().model }}</span>
          </div>
          <div class="status-body">
            <!-- Gauge SVG -->
            <div class="gauge-container">
              <svg class="gauge" viewBox="0 0 120 120">
                <circle class="gauge-bg" cx="60" cy="60" r="50"/>
                <circle class="gauge-fill" cx="60" cy="60" r="50"
                  [style.stroke-dasharray]="gpuGaugeDash()"
                  [class]="gpuUtilClass()"/>
                <text class="gauge-text" x="60" y="55" text-anchor="middle">{{ gpuInfo().utilization }}%</text>
                <text class="gauge-sublabel" x="60" y="72" text-anchor="middle">GPU Util</text>
              </svg>
            </div>
            <div class="gpu-details">
              <div class="gpu-detail">
                <span class="label">VRAM</span>
                <span class="value">{{ gpuInfo().vramUsed }}GB / {{ gpuInfo().vramTotal }}GB</span>
                <div class="mini-bar"><div class="mini-bar-fill" [style.width.%]="gpuInfo().vramPercent"></div></div>
              </div>
              <div class="gpu-detail">
                <span class="label">Temperatura</span>
                <span class="value" [class.hot]="gpuInfo().temperature > 80">{{ gpuInfo().temperature }}°C</span>
              </div>
              <div class="gpu-detail">
                <span class="label">Requests/min</span>
                <span class="value">{{ gpuInfo().requestsPerMin }}</span>
              </div>
            </div>
          </div>
          <div class="status-footer">
            <span>Modelo: {{ gpuInfo().activeModel }}</span>
            <span>LoRA: {{ gpuInfo().activeLoraVersion || 'Base' }}</span>
          </div>
        </div>

        <!-- Uso no Período -->
        <div class="status-card usage-card">
          <div class="status-header">
            <span class="status-label">&#128202; Uso — {{ selectedPeriod }}</span>
          </div>
          <div class="metrics-grid">
            <div class="metric">
              <span class="metric-value">{{ metrics().totalChatRequests | number }}</span>
              <span class="metric-label">Conversas</span>
              @if (metrics().chatsTrendPercent) {
                <span class="metric-trend" [class.up]="(metrics().chatsTrendPercent ?? 0) > 0">
                  {{ (metrics().chatsTrendPercent ?? 0) > 0 ? '↑' : '↓' }} {{ metrics().chatsTrendPercent | number:'1.0-0' }}%
                </span>
              }
            </div>
            <div class="metric">
              <span class="metric-value">{{ metrics().totalDocumentsProcessed | number }}</span>
              <span class="metric-label">Documentos</span>
            </div>
            <div class="metric">
              <span class="metric-value">{{ shortNumber(metrics().totalTokensInput + metrics().totalTokensOutput) }}</span>
              <span class="metric-label">Tokens</span>
            </div>
            <div class="metric">
              <span class="metric-value">{{ metrics().activeUsers }}</span>
              <span class="metric-label">Usuários ativos</span>
            </div>
          </div>
        </div>

        <!-- Custo -->
        <div class="status-card cost-card">
          <div class="status-header">
            <span class="status-label">&#128176; Custo Estimado</span>
          </div>
          <div class="cost-display">
            <span class="cost-value">R$ {{ metrics().estimatedCost?.total | number:'1.0-0' }}</span>
            <span class="cost-period">/{{ selectedPeriod }}</span>
          </div>
          <div class="cost-breakdown">
            <div class="cost-item">
              <span>GPU ({{ gpuInfo().provider }})</span>
              <span>R$ {{ metrics().estimatedCost?.gpu | number:'1.0-0' }}</span>
            </div>
            <div class="cost-item">
              <span>Storage</span>
              <span>R$ {{ metrics().estimatedCost?.storage | number:'1.0-0' }}</span>
            </div>
            <div class="cost-item">
              <span>Rede</span>
              <span>R$ {{ metrics().estimatedCost?.network | number:'1.0-0' }}</span>
            </div>
          </div>
          <div class="cost-peruser">
            Custo/usuário ativo: R$ {{ costPerUser() | number:'1.2-2' }}/mês
          </div>
        </div>
      </div>

      <!-- Tabelas -->
      <div class="tables-row">
        <!-- Top Projetos -->
        <div class="table-card">
          <h3>&#128218; Projetos Mais Ativos</h3>
          <table>
            <thead>
              <tr><th>Projeto</th><th>Chats</th><th>Docs</th><th>Tokens</th><th>Qualidade</th></tr>
            </thead>
            <tbody>
              @for (p of topProjects(); track p.id) {
                <tr class="clickable" [routerLink]="['/projects', p.id]">
                  <td><span class="dot" [style.background]="p.color"></span>{{ p.icon }} {{ p.name }}</td>
                  <td>{{ p.chatCount }}</td>
                  <td>{{ p.docCount }}</td>
                  <td>{{ shortNumber(p.tokensUsed) }}</td>
                  <td>
                    <div class="quality-bar">
                      <div class="quality-fill" [style.width.%]="p.avgQuality * 20"></div>
                    </div>
                    {{ p.avgQuality | number:'1.1-1' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Top Usuários -->
        <div class="table-card">
          <h3>&#128100; Usuários Mais Ativos</h3>
          <table>
            <thead>
              <tr><th>Usuário</th><th>Msgs</th><th>Feedback</th><th>Últ. atividade</th></tr>
            </thead>
            <tbody>
              @for (u of topUsers(); track u.id) {
                <tr class="clickable" [routerLink]="['/admin/users', u.id]">
                  <td><span class="user-avatar-sm">{{ u.name.slice(0,2) }}</span> {{ u.name }}</td>
                  <td>{{ u.messageCount }}</td>
                  <td>{{ u.feedbackCount }}</td>
                  <td>{{ u.lastActiveAt | date:'dd/MM HH:mm' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alertas -->
      @if (alerts().length > 0) {
        <div class="alerts-section">
          <h3>&#9888;&#65039; Ações Pendentes</h3>
          @for (alert of alerts(); track alert.id) {
            <div class="alert-card" [class]="alert.severity">
              <span class="alert-icon">{{ alert.severity === 'critical' ? '🔴' : '⚠️' }}</span>
              <div class="alert-content">
                <span class="alert-title">{{ alert.title }}</span>
                <span class="alert-description">{{ alert.description }}</span>
              </div>
              <button class="alert-action" (click)="handleAlert(alert)">{{ alert.actionLabel }}</button>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  workspaceName = signal('Workspace');
  selectedPeriod = '30d';

  systemHealth = signal<SystemHealth>({
    status: 'healthy', api: true, database: true, vectorDb: true, gpu: true,
    embedding: true, uptimePercent: 99.9, avgLatencyMs: 0
  });

  gpuInfo = signal<GpuInfo>({
    model: 'NVIDIA A100', utilization: 0, vramUsed: 0, vramTotal: 80,
    vramPercent: 0, temperature: 0, requestsPerMin: 0,
    activeModel: 'Llama 3.3 70B', activeLoraVersion: '', provider: 'Local'
  });

  metrics = signal<UsageMetrics>({
    period: '', totalTokensInput: 0, totalTokensOutput: 0, totalTokensEmbedding: 0,
    totalChatRequests: 0, totalRagQueries: 0, totalDocumentsProcessed: 0,
    totalTrainingRuns: 0, gpuHoursInference: 0, gpuHoursTraining: 0,
    gpuHoursEmbedding: 0, storageDocumentsGb: 0, storageVectorDbGb: 0,
    storageModelsGb: 0, estimatedCost: { gpu: 0, storage: 0, network: 0, total: 0, currency: 'BRL' },
    byProject: [], byUser: [], activeUsers: 0
  });

  topProjects = signal<any[]>([]);
  topUsers    = signal<any[]>([]);
  alerts      = signal<AdminAlert[]>([]);

  costPerUser = computed(() => {
    const u = this.metrics().activeUsers;
    return u > 0 ? this.metrics().estimatedCost?.total / u : 0;
  });

  gpuGaugeDash = computed(() => {
    const circumference = 2 * Math.PI * 50; // r=50
    const used = (this.gpuInfo().utilization / 100) * circumference;
    return `${used} ${circumference}`;
  });

  gpuUtilClass = computed(() => {
    const u = this.gpuInfo().utilization;
    if (u > 90) return 'critical';
    if (u > 70) return 'warning';
    return 'ok';
  });

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.loadAll();
    // Health check a cada 30s
    this.subs.push(
      interval(30_000).pipe(switchMap(() => this.http.get<SystemHealth>('/api/admin/health')))
        .subscribe((h) => this.systemHealth.set(h))
    );
    // GPU a cada 10s
    this.subs.push(
      interval(10_000).pipe(switchMap(() => this.http.get<GpuInfo>('/api/admin/gpu-status')))
        .subscribe((g) => this.gpuInfo.set(g))
    );
  }

  ngOnDestroy(): void { this.subs.forEach((s) => s.unsubscribe()); }

  loadAll(): void {
    forkJoin({
      health:   this.http.get<SystemHealth>('/api/admin/health'),
      gpu:      this.http.get<GpuInfo>('/api/admin/gpu-status'),
      metrics:  this.http.get<UsageMetrics>(`/api/admin/metrics?period=${this.selectedPeriod}`),
      projects: this.http.get<any[]>('/api/admin/metrics/top-projects?limit=5'),
      users:    this.http.get<any[]>('/api/admin/metrics/top-users?limit=5'),
      alerts:   this.http.get<AdminAlert[]>('/api/admin/alerts'),
      workspace: this.http.get<any>('/api/admin/settings'),
    }).subscribe({
      next: (data) => {
        this.systemHealth.set(data.health);
        this.gpuInfo.set(data.gpu);
        this.metrics.set(data.metrics);
        this.topProjects.set(data.projects);
        this.topUsers.set(data.users);
        this.alerts.set(data.alerts);
        if (data.workspace?.name) this.workspaceName.set(data.workspace.name);
      }
    });
  }

  loadMetrics(): void {
    this.http.get<UsageMetrics>(`/api/admin/metrics?period=${this.selectedPeriod}`)
      .subscribe((m) => this.metrics.set(m));
  }

  exportReport(): void {
    window.open(`/api/admin/metrics/export?period=${this.selectedPeriod}`, '_blank');
  }

  handleAlert(alert: AdminAlert): void {
    // Navega para a ação do alerta
    console.log('Handle alert:', alert.actionType);
  }

  shortNumber(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }
}
