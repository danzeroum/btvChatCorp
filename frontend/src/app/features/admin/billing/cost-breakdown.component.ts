import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UsageMetrics } from '../../../core/models/admin.model';

@Component({
  selector: 'app-cost-breakdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cost-breakdown">
      <div class="page-header">
        <div>
          <h1>&#128176; Custos e Billing</h1>
          <p>Estimativa de custos de infraestrutura da plataforma.</p>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedPeriod" (ngModelChange)="load()">
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
            <option value="90d">90 dias</option>
          </select>
        </div>
      </div>

      <!-- Total -->
      <div class="total-cost-card">
        <div class="total-display">
          <span class="total-label">Custo Total Estimado</span>
          <span class="total-value mono">R$ {{ metrics().estimatedCost?.total | number:'1.2-2' }}</span>
          <span class="total-period">no período selecionado</span>
        </div>
        <div class="cost-vs-month">
          <p>Projeção mensal: <strong class="mono">R$ {{ monthlyProjection() | number:'1.2-2' }}</strong></p>
          <p>Custo por token: <strong class="mono">R$ {{ costPerToken() | number:'1.6-6' }}</strong></p>
          <p>Custo por usuário ativo: <strong class="mono">R$ {{ costPerUser() | number:'1.2-2' }}</strong></p>
        </div>
      </div>

      <!-- Breakdown por categoria -->
      <div class="breakdown-cards">

        <!-- GPU -->
        <div class="breakdown-card gpu">
          <div class="breakdown-header">
            <span class="breakdown-icon">&#127956;</span>
            <div>
              <h3>GPU — Inferência e Treinamento</h3>
              <p>vLLM + fine-tuning LoRA</p>
            </div>
            <span class="breakdown-total mono">R$ {{ metrics().estimatedCost?.gpu | number:'1.2-2' }}</span>
          </div>
          <div class="breakdown-items">
            <div class="breakdown-item">
              <span>Inferência</span>
              <span>{{ metrics().gpuHoursInference | number:'1.1-1' }}h × R${{ gpuHourRate }}/h</span>
              <span class="mono">R$ {{ (metrics().gpuHoursInference * gpuHourRate) | number:'1.2-2' }}</span>
            </div>
            <div class="breakdown-item">
              <span>Treinamento LoRA</span>
              <span>{{ metrics().gpuHoursTraining | number:'1.1-1' }}h × R${{ gpuHourRate }}/h</span>
              <span class="mono">R$ {{ (metrics().gpuHoursTraining * gpuHourRate) | number:'1.2-2' }}</span>
            </div>
            <div class="breakdown-item">
              <span>Embedding</span>
              <span>{{ metrics().gpuHoursEmbedding | number:'1.1-1' }}h × R${{ gpuHourRate * 0.3 | number:'1.2-2' }}/h</span>
              <span class="mono">R$ {{ (metrics().gpuHoursEmbedding * gpuHourRate * 0.3) | number:'1.2-2' }}</span>
            </div>
          </div>
          <div class="breakdown-bar">
            <div class="breakdown-fill" [style.width.%]="gpuPercent()"></div>
          </div>
          <span class="breakdown-percent">{{ gpuPercent() | number:'1.0-0' }}% do total</span>
        </div>

        <!-- Storage -->
        <div class="breakdown-card storage">
          <div class="breakdown-header">
            <span class="breakdown-icon">&#128190;</span>
            <div>
              <h3>Storage</h3>
              <p>Documentos, Vector DB, Modelos</p>
            </div>
            <span class="breakdown-total mono">R$ {{ metrics().estimatedCost?.storage | number:'1.2-2' }}</span>
          </div>
          <div class="breakdown-items">
            <div class="breakdown-item">
              <span>Documentos</span>
              <span>{{ metrics().storageDocumentsGb | number:'1.1-1' }} GB</span>
              <span class="mono">R$ {{ (metrics().storageDocumentsGb * storageGbRate) | number:'1.2-2' }}</span>
            </div>
            <div class="breakdown-item">
              <span>Vector DB (Qdrant)</span>
              <span>{{ metrics().storageVectorDbGb | number:'1.1-1' }} GB</span>
              <span class="mono">R$ {{ (metrics().storageVectorDbGb * storageGbRate * 2) | number:'1.2-2' }}</span>
            </div>
            <div class="breakdown-item">
              <span>Modelos LoRA</span>
              <span>{{ metrics().storageModelsGb | number:'1.1-1' }} GB</span>
              <span class="mono">R$ {{ (metrics().storageModelsGb * storageGbRate * 0.5) | number:'1.2-2' }}</span>
            </div>
          </div>
          <div class="breakdown-bar">
            <div class="breakdown-fill storage-fill" [style.width.%]="storagePercent()"></div>
          </div>
          <span class="breakdown-percent">{{ storagePercent() | number:'1.0-0' }}% do total</span>
        </div>

        <!-- Rede -->
        <div class="breakdown-card network">
          <div class="breakdown-header">
            <span class="breakdown-icon">&#127760;</span>
            <div>
              <h3>Rede</h3>
              <p>Transferência de dados</p>
            </div>
            <span class="breakdown-total mono">R$ {{ metrics().estimatedCost?.network | number:'1.2-2' }}</span>
          </div>
          <div class="breakdown-bar">
            <div class="breakdown-fill network-fill" [style.width.%]="networkPercent()"></div>
          </div>
          <span class="breakdown-percent">{{ networkPercent() | number:'1.0-0' }}% do total</span>
        </div>
      </div>

      <!-- Por projeto — CSS Grid replacing table -->
      <div class="table-card">
        <h3>Custo por Projeto</h3>
        <div class="proj-grid">
          <div class="grid-header">
            <span>Projeto</span>
            <span>Tokens</span>
            <span>% do Total</span>
            <span>Custo Estimado</span>
          </div>
          @for (p of metrics().byProject; track p.projectId) {
            <div class="grid-row">
              <span>{{ p.projectName }}</span>
              <span class="mono">{{ shortNumber(p.tokensUsed) }}</span>
              <span class="percent-cell">
                <div class="percent-bar"><div class="percent-fill" [style.width.%]="p.percentOfTotal"></div></div>
                {{ p.percentOfTotal | number:'1.1-1' }}%
              </span>
              <span class="mono">R$ {{ (metrics().estimatedCost?.total * p.percentOfTotal / 100) | number:'1.2-2' }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
    .cost-breakdown { padding: 28px 32px; background: var(--panel-2); min-height: 100vh; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header h1 { font-size:22px; font-weight:700; color: var(--ink); margin:0 0 4px; }
    .page-header p { font-size:13px; color: var(--ink-2); margin:0; }
    .header-actions select { background: var(--white); border:1px solid var(--line); border-radius:8px; padding:7px 12px; font-size:13px; color: var(--ink); font-family:'IBM Plex Sans',system-ui,sans-serif; }
    .header-actions select:focus { outline:none; border-color: var(--acc); }
    .total-cost-card { background: var(--white); border:1px solid var(--line); border-radius:12px; padding:24px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; }
    .total-display { display:flex; flex-direction:column; gap:4px; }
    .total-label { font-size:12px; color: var(--ink-2); font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
    .total-value { font-size:32px; font-weight:700; color: var(--ink); }
    .total-period { font-size:12px; color: var(--ink-3); }
    .cost-vs-month { display:flex; flex-direction:column; gap:4px; }
    .cost-vs-month p { margin:0; font-size:13px; color: var(--ink-2); }
    .mono { font-family: 'IBM Plex Mono', monospace; }
    .breakdown-cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px; margin-bottom:16px; }
    .breakdown-card { background: var(--white); border:1px solid var(--line); border-radius:12px; padding:20px 24px; }
    .breakdown-card.gpu { border-left:3px solid var(--acc); }
    .breakdown-card.storage { border-left:3px solid #10b981; }
    .breakdown-card.network { border-left:3px solid #f59e0b; }
    .breakdown-header { display:flex; align-items:flex-start; gap:12px; margin-bottom:16px; }
    .breakdown-icon { font-size:22px; flex-shrink:0; }
    .breakdown-header h3 { font-size:14px; font-weight:600; color: var(--ink); margin:0 0 2px; }
    .breakdown-header p { font-size:12px; color: var(--ink-2); margin:0; }
    .breakdown-total { margin-left:auto; font-size:16px; font-weight:700; color: var(--ink); white-space:nowrap; }
    .breakdown-items { display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
    .breakdown-item { display:flex; justify-content:space-between; font-size:12px; color: var(--ink); }
    .breakdown-bar { height:6px; background: var(--panel-2); border-radius:3px; overflow:hidden; margin-bottom:6px; }
    .breakdown-fill { height:100%; background: var(--acc); border-radius:3px; }
    .storage-fill { background:#10b981; }
    .network-fill { background:#f59e0b; }
    .breakdown-percent { font-size:11px; color: var(--ink-3); }
    .table-card { background: var(--white); border:1px solid var(--line); border-radius:12px; padding:20px 24px; margin-bottom:16px; }
    .table-card h3 { font-size:15px; font-weight:600; color: var(--ink); margin:0 0 16px; }
    /* CSS Grid table */
    .proj-grid { border-radius:8px; overflow:hidden; border:1px solid var(--line); }
    .proj-grid .grid-header { display:grid; grid-template-columns:2fr 1fr 2fr 1fr; padding:9px 14px; background: var(--panel-2); border-bottom:1px solid var(--line); }
    .proj-grid .grid-header span { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color: var(--ink-3); }
    .proj-grid .grid-row { display:grid; grid-template-columns:2fr 1fr 2fr 1fr; align-items:center; padding:10px 14px; font-size:13px; color: var(--ink); border-bottom:1px solid var(--panel-2); }
    .proj-grid .grid-row:last-child { border-bottom:none; }
    .proj-grid .grid-row:hover { background: var(--panel-2); }
    .percent-cell { display:flex; align-items:center; gap:8px; }
    .percent-bar { height:6px; background: var(--panel-2); border-radius:3px; overflow:hidden; width:60px; flex-shrink:0; }
    .percent-fill { height:100%; background: var(--acc); border-radius:3px; }
  `]
})
export class CostBreakdownComponent implements OnInit {
  private http = inject(HttpClient);

  selectedPeriod = '30d';
  gpuHourRate    = 12.0;
  storageGbRate  = 0.15;

  metrics = signal<UsageMetrics>({
    period: '', totalTokensInput: 0, totalTokensOutput: 0, totalTokensEmbedding: 0,
    totalChatRequests: 0, totalRagQueries: 0, totalDocumentsProcessed: 0,
    totalTrainingRuns: 0, gpuHoursInference: 0, gpuHoursTraining: 0,
    gpuHoursEmbedding: 0, storageDocumentsGb: 0, storageVectorDbGb: 0,
    storageModelsGb: 0, estimatedCost: { gpu: 0, storage: 0, network: 0, total: 0, currency: 'BRL' },
    byProject: [], byUser: [], activeUsers: 0
  });

  monthlyProjection = computed(() => {
    const total = this.metrics().estimatedCost?.total ?? 0;
    const days  = this.selectedPeriod === '7d' ? 7 : this.selectedPeriod === '30d' ? 30 : 90;
    return (total / days) * 30;
  });

  costPerToken = computed(() => {
    const tokens = this.metrics().totalTokensInput + this.metrics().totalTokensOutput;
    const total  = this.metrics().estimatedCost?.total ?? 0;
    return tokens > 0 ? total / tokens : 0;
  });

  costPerUser = computed(() => {
    const u     = this.metrics().activeUsers;
    const total = this.metrics().estimatedCost?.total ?? 0;
    return u > 0 ? total / u : 0;
  });

  gpuPercent = computed(() => {
    const t = this.metrics().estimatedCost?.total || 1;
    return ((this.metrics().estimatedCost?.gpu ?? 0) / t) * 100;
  });

  storagePercent = computed(() => {
    const t = this.metrics().estimatedCost?.total || 1;
    return ((this.metrics().estimatedCost?.storage ?? 0) / t) * 100;
  });

  networkPercent = computed(() => {
    const t = this.metrics().estimatedCost?.total || 1;
    return ((this.metrics().estimatedCost?.network ?? 0) / t) * 100;
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<UsageMetrics>(`/api/admin/metrics?period=${this.selectedPeriod}`)
      .subscribe((m) => this.metrics.set(m));
  }

  shortNumber(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }
}
