import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, interval, Subscription, switchMap } from 'rxjs';
import { SystemHealth, GpuInfo, UsageMetrics, AdminAlert } from '../../../core/models/admin.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DecimalPipe, DatePipe],
  template: `
    <div class="dashboard">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Visão geral</h1>
          <p class="page-sub">{{ workspaceName() }} · Enterprise · atualizado há 2 min</p>
        </div>
        <div class="header-right">
          <select class="period-select" [(ngModel)]="selectedPeriod" (ngModelChange)="loadMetrics()">
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
          <button class="btn-outline" (click)="exportReport()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Exportar
          </button>
        </div>
      </div>

      <!-- System Status Bar -->
      <div class="status-bar">
        <div class="status-indicator" [class.healthy]="systemHealth().status === 'healthy'"
             [class.degraded]="systemHealth().status === 'degraded'">
          <span class="status-dot"></span>
          <span>{{ systemHealth().status === 'healthy' ? 'Sistema operacional' : 'Sistema degradado' }}</span>
        </div>
        <div class="status-services">
          @for (svc of services(); track svc.name) {
            <div class="svc-pill" [class.ok]="svc.ok" [class.err]="!svc.ok">
              <span class="svc-dot"></span>
              <span>{{ svc.name }}</span>
            </div>
          }
        </div>
        <div class="status-meta">
          <span>uptime <strong>{{ systemHealth().uptimePercent | number:'1.2-2' }}%</strong></span>
          <span class="sep">·</span>
          <span>latência <strong>{{ systemHealth().avgLatencyMs }}ms</strong></span>
        </div>
      </div>

      <!-- Needs Attention -->
      @if (alerts().length > 0) {
        <section class="section">
          <div class="section-header">
            <span class="section-title">Precisa da sua atenção</span>
            <span class="attention-count">{{ alerts().length }}</span>
            <span class="section-hint">ações priorizadas por impacto</span>
          </div>
          <div class="alerts-grid">
            @for (alert of alerts(); track alert.id) {
              <div class="alert-card" [class]="'alert-' + alert.severity">
                <div class="alert-icon-wrap">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    @if (alert.severity === 'critical') {
                      <path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                      <path d="M8 6v3M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    } @else {
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M8 5v3M8 10v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    }
                  </svg>
                </div>
                <div class="alert-body">
                  <p class="alert-title">{{ alert.title }}</p>
                  <p class="alert-desc">{{ alert.description }}</p>
                </div>
                <button class="alert-action" (click)="handleAlert(alert)">
                  {{ alert.actionLabel }} →
                </button>
              </div>
            }
          </div>
        </section>
      }

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Usuários ativos</span>
          <span class="kpi-value">{{ metrics().activeUsers | number }}</span>
          @if (metrics().chatsTrendPercent) {
            <span class="kpi-trend up">↑ {{ metrics().chatsTrendPercent | number:'1.0-0' }} no mês</span>
          }
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Conversas · {{ selectedPeriod }}</span>
          <span class="kpi-value">{{ metrics().totalChatRequests | number }}</span>
          <span class="kpi-trend up">↑ 6%</span>
        </div>
        <div class="kpi-card gpu-kpi-card">
          <span class="kpi-label">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="vertical-align:-2px;margin-right:4px">
              <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/>
              <path d="M4 9h8M4 7h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            GPU
            <span class="gpu-model-tag">{{ gpuInfo().model }}</span>
          </span>
          <div class="gpu-gauge-inline">
            <svg class="gauge-svg" viewBox="0 0 100 100">
              <circle class="gauge-track" cx="50" cy="50" r="42" fill="none"
                stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
              <circle class="gauge-fill" cx="50" cy="50" r="42" fill="none"
                [class]="'gfill-' + gpuUtilClass()"
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray="263.9"
                [attr.stroke-dashoffset]="gaugeOffset()"
                transform="rotate(-90 50 50)"/>
              <text x="50" y="46" text-anchor="middle" class="gauge-num">{{ gpuInfo().utilization }}%</text>
              <text x="50" y="60" text-anchor="middle" class="gauge-sub">GPU Util</text>
            </svg>
            <div class="gpu-stats">
              <div class="gpu-stat">
                <span class="gs-label">VRAM</span>
                <span class="gs-val">{{ gpuInfo().vramUsed }}GB / {{ gpuInfo().vramTotal }}GB</span>
                <div class="gs-bar"><div class="gs-fill" [style.width.%]="gpuInfo().vramPercent"></div></div>
              </div>
              <div class="gpu-stat">
                <span class="gs-label">Modelo ativo</span>
                <span class="gs-val">{{ gpuInfo().activeModel }}</span>
              </div>
              <div class="gpu-stat">
                <span class="gs-label">Req/min</span>
                <span class="gs-val">{{ gpuInfo().requestsPerMin }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="kpi-card cost-kpi-card">
          <span class="kpi-label">$ Custo estimado · {{ selectedPeriod }}</span>
          <span class="kpi-value cost-value">R$ {{ metrics().estimatedCost?.total | number:'1.0-0' }}</span>
          <div class="cost-rows">
            <div class="cost-row">
              <span>GPU ({{ gpuInfo().provider }})</span>
              <div class="cost-bar-wrap">
                <div class="cost-bar-fill gpu-bar" [style.width.%]="gpuCostPct()"></div>
              </div>
              <span>R$ {{ metrics().estimatedCost?.gpu | number:'1.0-0' }}</span>
            </div>
            <div class="cost-row">
              <span>Storage</span>
              <div class="cost-bar-wrap">
                <div class="cost-bar-fill" [style.width.%]="storageCostPct()"></div>
              </div>
              <span>R$ {{ metrics().estimatedCost?.storage | number:'1.0-0' }}</span>
            </div>
            <div class="cost-row">
              <span>Rede</span>
              <div class="cost-bar-wrap">
                <div class="cost-bar-fill" [style.width.%]="networkCostPct()"></div>
              </div>
              <span>R$ {{ metrics().estimatedCost?.network | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Tokens · {{ selectedPeriod }}</span>
          <span class="kpi-value">{{ shortNumber(metrics().totalTokensInput + metrics().totalTokensOutput) }}</span>
          <span class="kpi-sub">Custo/usuário R$ {{ costPerUser() | number:'1.2-2' }}/mês</span>
        </div>
      </div>

      <!-- Top Tables -->
      <div class="tables-row">
        <div class="table-card">
          <div class="tc-header">
            <h3 class="tc-title">Projetos Mais Ativos</h3>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Projeto</th>
                <th class="num">Chats</th>
                <th class="num">Docs</th>
                <th class="num">Tokens</th>
                <th>Qualidade</th>
              </tr>
            </thead>
            <tbody>
              @for (p of topProjects(); track p.id) {
                <tr class="clickable" [routerLink]="['/projects', p.id]">
                  <td>
                    <div class="cell-project">
                      <span class="proj-dot" [style.background]="p.color"></span>
                      <span>{{ p.icon }} {{ p.name }}</span>
                    </div>
                  </td>
                  <td class="num">{{ p.chatCount }}</td>
                  <td class="num">{{ p.docCount }}</td>
                  <td class="num">{{ shortNumber(p.tokensUsed) }}</td>
                  <td>
                    <div class="quality-wrap">
                      <div class="quality-bar">
                        <div class="quality-fill" [style.width.%]="p.avgQuality * 20"></div>
                      </div>
                      <span class="quality-num">{{ p.avgQuality | number:'1.1-1' }}</span>
                    </div>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="5" class="empty-row">Nenhum projeto ainda</td></tr>
              }
            </tbody>
          </table>
        </div>

        <div class="table-card">
          <div class="tc-header">
            <h3 class="tc-title">Usuários Mais Ativos</h3>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th class="num">Msgs</th>
                <th class="num">Feedback</th>
                <th>Últ. atividade</th>
              </tr>
            </thead>
            <tbody>
              @for (u of topUsers(); track u.id) {
                <tr class="clickable" [routerLink]="['/admin/users']">
                  <td>
                    <div class="cell-user">
                      <span class="user-av">{{ u.name?.slice(0,2) }}</span>
                      <span>{{ u.name }}</span>
                    </div>
                  </td>
                  <td class="num">{{ u.messageCount }}</td>
                  <td class="num">{{ u.feedbackCount }}</td>
                  <td class="date-cell">{{ u.lastActiveAt | date:'dd/MM HH:mm' }}</td>
                </tr>
              }
              @empty {
                <tr><td colspan="4" class="empty-row">Nenhum dado ainda</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Admin Areas -->
      <section class="section">
        <div class="section-header">
          <span class="section-title">Áreas de administração</span>
        </div>
        <div class="areas-grid">
          @for (area of adminAreas; track area.route) {
            <a class="area-card" [routerLink]="area.route">
              <div class="area-icon" [innerHTML]="area.icon"></div>
              <div class="area-body">
                <span class="area-title">{{ area.title }}</span>
                <span class="area-desc">{{ area.desc }}</span>
              </div>
              <svg class="area-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 28px 32px;
      max-width: 1200px;
      margin: 0 auto;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .page-title {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
    }
    .page-sub { font-size: 13px; color: #64748b; margin: 0; }
    .header-right { display: flex; gap: 10px; align-items: center; }
    .period-select {
      padding: 7px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      color: #374151;
      background: #fff;
      cursor: pointer;
    }
    .btn-outline {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      transition: border-color 0.12s, background 0.12s;
    }
    .btn-outline:hover { border-color: #6366f1; color: #6366f1; }

    /* Status bar */
    .status-bar {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 10px 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
    }
    .status-indicator.healthy { color: #15803d; }
    .status-indicator.degraded { color: #b45309; }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #94a3b8;
    }
    .status-indicator.healthy .status-dot { background: #22c55e; }
    .status-indicator.degraded .status-dot { background: #f59e0b; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
    .status-services { display: flex; gap: 12px; flex-wrap: wrap; flex: 1; }
    .svc-pill {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #94a3b8;
    }
    .svc-pill.ok { color: #374151; }
    .svc-pill.err { color: #dc2626; }
    .svc-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .status-meta { font-size: 12px; color: #94a3b8; display: flex; gap: 6px; align-items: center; }
    .status-meta strong { color: #374151; }
    .sep { opacity: 0.5; }

    /* Section */
    .section { margin-bottom: 28px; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
    }
    .section-title { font-size: 15px; font-weight: 600; color: #0f172a; }
    .attention-count {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ef4444;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .section-hint { font-size: 12px; color: #94a3b8; margin-left: auto; }

    /* Alerts */
    .alerts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 12px;
    }
    .alert-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border-radius: 10px;
      border: 1px solid #fde68a;
      background: #fffbeb;
    }
    .alert-card.alert-critical {
      border-color: #fca5a5;
      background: #fff5f5;
    }
    .alert-icon-wrap {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: rgba(245,158,11,0.12);
      color: #d97706;
    }
    .alert-critical .alert-icon-wrap { background: rgba(239,68,68,0.1); color: #dc2626; }
    .alert-body { flex: 1; min-width: 0; }
    .alert-title { display: block; font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 3px; }
    .alert-desc { display: block; font-size: 12px; color: #64748b; }
    .alert-action {
      flex-shrink: 0;
      padding: 6px 14px;
      border-radius: 7px;
      border: none;
      background: #d97706;
      color: #fff;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s;
    }
    .alert-action:hover { background: #b45309; }
    .alert-critical .alert-action { background: #dc2626; }
    .alert-critical .alert-action:hover { background: #b91c1c; }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1.6fr 1.4fr 1fr;
      gap: 14px;
      margin-bottom: 24px;
    }
    @media (max-width: 1100px) {
      .kpi-grid { grid-template-columns: 1fr 1fr; }
      .gpu-kpi-card, .cost-kpi-card { grid-column: span 2; }
    }
    .kpi-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .kpi-label { font-size: 12px; color: #64748b; font-weight: 500; }
    .kpi-value { font-size: 28px; font-weight: 700; color: #0f172a; line-height: 1.1; }
    .kpi-trend {
      font-size: 12px;
      color: #16a34a;
      font-weight: 500;
    }
    .kpi-sub { font-size: 12px; color: #94a3b8; }

    /* GPU card */
    .gpu-kpi-card { padding: 18px 20px; }
    .gpu-model-tag {
      margin-left: 6px;
      font-size: 10px;
      background: #f1f5f9;
      color: #64748b;
      padding: 1px 7px;
      border-radius: 20px;
      font-weight: 500;
    }
    .gpu-gauge-inline {
      display: flex;
      gap: 20px;
      align-items: center;
      margin-top: 10px;
    }
    .gauge-svg {
      width: 90px;
      height: 90px;
      flex-shrink: 0;
    }
    .gauge-track { }
    .gauge-fill { transition: stroke-dashoffset 0.4s ease; }
    .gfill-ok { stroke: #22c55e; }
    .gfill-warning { stroke: #f59e0b; }
    .gfill-critical { stroke: #ef4444; }
    .gauge-num {
      font-size: 20px;
      font-weight: 700;
      fill: #0f172a;
      font-family: 'Inter', sans-serif;
    }
    .gauge-sub {
      font-size: 9px;
      fill: #94a3b8;
      font-family: 'Inter', sans-serif;
    }
    .gpu-stats { display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .gpu-stat { display: flex; flex-direction: column; gap: 3px; }
    .gs-label { font-size: 11px; color: #94a3b8; }
    .gs-val { font-size: 12.5px; font-weight: 500; color: #1e293b; }
    .gs-bar {
      height: 4px;
      background: #f1f5f9;
      border-radius: 2px;
      overflow: hidden;
    }
    .gs-fill {
      height: 100%;
      background: #6366f1;
      border-radius: 2px;
    }

    /* Cost card */
    .cost-value { font-size: 26px; }
    .cost-rows { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
    .cost-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #64748b;
    }
    .cost-row > span:first-child { width: 90px; flex-shrink: 0; }
    .cost-row > span:last-child { width: 60px; text-align: right; flex-shrink: 0; }
    .cost-bar-wrap {
      flex: 1;
      height: 6px;
      background: #f1f5f9;
      border-radius: 3px;
      overflow: hidden;
    }
    .cost-bar-fill {
      height: 100%;
      background: #6366f1;
      border-radius: 3px;
      transition: width 0.4s ease;
    }
    .cost-bar-fill.gpu-bar { background: #ef4444; }

    /* Tables */
    .tables-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 28px;
    }
    @media (max-width: 900px) { .tables-row { grid-template-columns: 1fr; } }
    .table-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .tc-header {
      padding: 16px 20px 0;
    }
    .tc-title { font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 12px; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
    }
    .data-table th {
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #94a3b8;
      text-align: left;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      border-bottom: 1px solid #f1f5f9;
    }
    .data-table th.num { text-align: right; }
    .data-table td {
      padding: 11px 16px;
      font-size: 13px;
      color: #374151;
      border-bottom: 1px solid #f8fafc;
    }
    .data-table td.num { text-align: right; color: #1e293b; font-weight: 500; }
    .data-table td.date-cell { color: #94a3b8; font-size: 12px; }
    .data-table tr.clickable { cursor: pointer; }
    .data-table tr.clickable:hover td { background: #f8fafc; }
    .empty-row { text-align: center; color: #94a3b8; font-size: 13px; padding: 24px !important; }
    .cell-project { display: flex; align-items: center; gap: 8px; }
    .proj-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .cell-user { display: flex; align-items: center; gap: 8px; }
    .user-av {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      background: #ede9fe;
      color: #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .quality-wrap { display: flex; align-items: center; gap: 8px; }
    .quality-bar {
      width: 60px;
      height: 6px;
      background: #f1f5f9;
      border-radius: 3px;
      overflow: hidden;
    }
    .quality-fill { height: 100%; background: #22c55e; border-radius: 3px; }
    .quality-num { font-size: 12px; color: #64748b; }

    /* Areas grid */
    .areas-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }
    .area-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
      cursor: pointer;
    }
    .area-card:hover {
      border-color: #a5b4fc;
      box-shadow: 0 2px 12px rgba(99,102,241,0.08);
    }
    .area-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #f0f0ff;
      color: #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .area-icon svg { width: 18px; height: 18px; }
    .area-body { flex: 1; overflow: hidden; }
    .area-title { display: block; font-size: 13.5px; font-weight: 600; color: #1e293b; }
    .area-desc { display: block; font-size: 11.5px; color: #94a3b8; margin-top: 2px; }
    .area-arrow { color: #cbd5e1; flex-shrink: 0; }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  workspaceName = signal('Workspace');
  selectedPeriod = '30d';

  systemHealth = signal<SystemHealth>({
    status: 'healthy', api: true, database: true, vectorDb: true, gpu: true,
    embedding: true, uptimePercent: 99.98, avgLatencyMs: 240
  });

  gpuInfo = signal<GpuInfo>({
    model: 'A100', utilization: 73, vramUsed: 58, vramTotal: 80,
    vramPercent: 72.5, temperature: 68, requestsPerMin: 42,
    activeModel: 'Llama 3.3 70B', activeLoraVersion: '', provider: 'Local'
  });

  metrics = signal<UsageMetrics>({
    period: '30d', totalTokensInput: 5_200_000, totalTokensOutput: 2_300_000,
    totalTokensEmbedding: 0, totalChatRequests: 2447, totalRagQueries: 0,
    totalDocumentsProcessed: 0, totalTrainingRuns: 0, gpuHoursInference: 0,
    gpuHoursTraining: 0, gpuHoursEmbedding: 0, storageDocumentsGb: 0,
    storageVectorDbGb: 0, storageModelsGb: 0,
    estimatedCost: { gpu: 3180, storage: 640, network: 390, total: 4210, currency: 'BRL' },
    byProject: [], byUser: [], activeUsers: 342, chatsTrendPercent: 18
  });

  topProjects = signal<any[]>([]);
  topUsers    = signal<any[]>([]);
  alerts      = signal<AdminAlert[]>([]);

  services = computed(() => [
    { name: 'API',        ok: this.systemHealth().api },
    { name: 'GPU · vLLM', ok: this.systemHealth().gpu },
    { name: 'PostgreSQL', ok: this.systemHealth().database },
    { name: 'Qdrant',     ok: this.systemHealth().vectorDb },
    { name: 'Embedding',  ok: this.systemHealth().embedding },
  ]);

  costPerUser = computed(() => {
    const u = this.metrics().activeUsers;
    return u > 0 ? (this.metrics().estimatedCost?.total ?? 0) / u : 0;
  });

  gpuUtilClass = computed(() => {
    const u = this.gpuInfo().utilization;
    if (u > 90) return 'critical';
    if (u > 70) return 'warning';
    return 'ok';
  });

  gaugeOffset = computed(() => {
    const circumference = 263.9;
    const used = (1 - this.gpuInfo().utilization / 100) * circumference;
    return used;
  });

  gpuCostPct = computed(() => {
    const total = this.metrics().estimatedCost?.total || 1;
    return ((this.metrics().estimatedCost?.gpu || 0) / total) * 100;
  });
  storageCostPct = computed(() => {
    const total = this.metrics().estimatedCost?.total || 1;
    return ((this.metrics().estimatedCost?.storage || 0) / total) * 100;
  });
  networkCostPct = computed(() => {
    const total = this.metrics().estimatedCost?.total || 1;
    return ((this.metrics().estimatedCost?.network || 0) / total) * 100;
  });

  adminAreas = [
    {
      title: 'Usuários & papéis',
      desc: '342 membros · 3 papéis',
      route: '/admin/users',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="7" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/>
        <path d="M2 16c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M13 9c2 0 4 1.2 4 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="13" cy="5.5" r="2" stroke="currentColor" stroke-width="1.5"/>
      </svg>`,
    },
    {
      title: 'Auditoria',
      desc: '1.204 eventos · 30d',
      route: '/admin/audit',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="1" width="11" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 6h7M5 9h7M5 12h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`,
    },
    {
      title: 'Compliance LGPD',
      desc: 'Score 92 · 1 pendência',
      route: '/admin/settings',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1.5L3 4.5V9c0 4 3 7 6 8 3-1 6-4 6-8V4.5L9 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`,
    },
    {
      title: 'Modelos & LoRA',
      desc: 'Llama 3.3 70B ativo',
      route: '/admin/ai-config',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="9" cy="9" r="2" fill="currentColor"/>
      </svg>`,
    },
    {
      title: 'Uso & custos',
      desc: 'R$ 4.210 · 30d',
      route: '/admin/billing',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1.5" y="5" width="15" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M1.5 9h15" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="5.5" cy="12" r="1.2" fill="currentColor"/>
      </svg>`,
    },
    {
      title: 'API Keys',
      desc: '3 chaves ativas',
      route: '/admin/api-keys',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="6" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8.5 10.5L16 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M13.5 14l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    },
  ];

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.loadAll();
    this.subs.push(
      interval(30_000).pipe(switchMap(() =>
        this.http.get<SystemHealth>('/api/v1/admin/health')))
        .subscribe((h) => this.systemHealth.set(h))
    );
    this.subs.push(
      interval(10_000).pipe(switchMap(() =>
        this.http.get<GpuInfo>('/api/v1/admin/gpu-status')))
        .subscribe((g) => this.gpuInfo.set(g))
    );
  }

  ngOnDestroy(): void { this.subs.forEach((s) => s.unsubscribe()); }

  loadAll(): void {
    forkJoin({
      health:   this.http.get<SystemHealth>('/api/v1/admin/health'),
      gpu:      this.http.get<GpuInfo>('/api/v1/admin/gpu-status'),
      metrics:  this.http.get<UsageMetrics>(`/api/v1/admin/metrics?period=${this.selectedPeriod}`),
      projects: this.http.get<any[]>('/api/v1/admin/metrics/top-projects?limit=5'),
      users:    this.http.get<any[]>('/api/v1/admin/metrics/top-users?limit=5'),
      alerts:   this.http.get<AdminAlert[]>('/api/v1/admin/alerts'),
      workspace: this.http.get<any>('/api/v1/admin/settings'),
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
    this.http.get<UsageMetrics>(`/api/v1/admin/metrics?period=${this.selectedPeriod}`)
      .subscribe((m) => this.metrics.set(m));
  }

  exportReport(): void {
    window.open(`/api/v1/admin/metrics/export?period=${this.selectedPeriod}`, '_blank');
  }

  handleAlert(alert: AdminAlert): void {
    console.log('Handle alert:', alert.actionType);
  }

  shortNumber(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }
}
