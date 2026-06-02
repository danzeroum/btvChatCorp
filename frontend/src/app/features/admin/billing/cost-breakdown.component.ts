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
          <span class="total-value">R$ {{ metrics().estimatedCost?.total | number:'1.2-2' }}</span>
          <span class="total-period">no período selecionado</span>
        </div>
        <div class="cost-vs-month">
          <p>Projeção mensal: <strong>R$ {{ monthlyProjection() | number:'1.2-2' }}</strong></p>
          <p>Custo por token: <strong>R$ {{ costPerToken() | number:'1.6-6' }}</strong></p>
          <p>Custo por usuário ativo: <strong>R$ {{ costPerUser() | number:'1.2-2' }}</strong></p>
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
            <span class="breakdown-total">R$ {{ metrics().estimatedCost?.gpu | number:'1.2-2' }}</span>
          </div>
          <div class="breakdown-items">
            <div class="breakdown-item">
              <span>Inferência</span>
              <span>{{ metrics().gpuHoursInference | number:'1.1-1' }}h × R${{ gpuHourRate }}/h</span>
              <span>R$ {{ (metrics().gpuHoursInference * gpuHourRate) | number:'1.2-2' }}</span>
            </div>
            <div class="breakdown-item">
              <span>Treinamento LoRA</span>
              <span>{{ metrics().gpuHoursTraining | number:'1.1-1' }}h × R${{ gpuHourRate }}/h</span>
              <span>R$ {{ (metrics().gpuHoursTraining * gpuHourRate) | number:'1.2-2' }}</span>
            </div>
            <div class="breakdown-item">
              <span>Embedding</span>
              <span>{{ metrics().gpuHoursEmbedding | number:'1.1-1' }}h × R${{ gpuHourRate * 0.3 | number:'1.2-2' }}/h</span>
              <span>R$ {{ (metrics().gpuHoursEmbedding * gpuHourRate * 0.3) | number:'1.2-2' }}</span>
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
            <span class="breakdown-total">R$ {{ metrics().estimatedCost?.storage | number:'1.2-2' }}</span>
          </div>
          <div class="breakdown-items">
            <div class="breakdown-item">
              <span>Documentos</span>
              <span>{{ metrics().storageDocumentsGb | number:'1.1-1' }} GB</span>
              <span>R$ {{ (metrics().storageDocumentsGb * storageGbRate) | number:'1.2-2' }}</span>
            </div>
            <div class="breakdown-item">
              <span>Vector DB (Qdrant)</span>
              <span>{{ metrics().storageVectorDbGb | number:'1.1-1' }} GB</span>
              <span>R$ {{ (metrics().storageVectorDbGb * storageGbRate * 2) | number:'1.2-2' }}</span>
            </div>
            <div class="breakdown-item">
              <span>Modelos LoRA</span>
              <span>{{ metrics().storageModelsGb | number:'1.1-1' }} GB</span>
              <span>R$ {{ (metrics().storageModelsGb * storageGbRate * 0.5) | number:'1.2-2' }}</span>
            </div>
          </div>
          <div class="breakdown-bar">
            <div class="breakdown-fill" [style.width.%]="storagePercent()"></div>
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
            <span class="breakdown-total">R$ {{ metrics().estimatedCost?.network | number:'1.2-2' }}</span>
          </div>
          <div class="breakdown-bar">
            <div class="breakdown-fill" [style.width.%]="networkPercent()"></div>
          </div>
          <span class="breakdown-percent">{{ networkPercent() | number:'1.0-0' }}% do total</span>
        </div>
      </div>

      <!-- Por projeto -->
      <div class="table-card">
        <h3>Custo por Projeto</h3>
        <table>
          <thead>
            <tr><th>Projeto</th><th>Tokens</th><th>% do Total</th><th>Custo Estimado</th></tr>
          </thead>
          <tbody>
            @for (p of metrics().byProject; track p.projectId) {
              <tr>
                <td>{{ p.projectName }}</td>
                <td>{{ shortNumber(p.tokensUsed) }}</td>
                <td>
                  <div class="percent-bar">
                    <div class="percent-fill" [style.width.%]="p.percentOfTotal"></div>
                  </div>
                  {{ p.percentOfTotal | number:'1.1-1' }}%
                </td>
                <td>R$ {{ (metrics().estimatedCost?.total * p.percentOfTotal / 100) | number:'1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; font-family: Inter, system-ui, sans-serif; }
    .cost-breakdown { padding: 28px 32px; background: #f8fafc; min-height: 100vh; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header h1 { font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .page-header p { font-size:13px; color:#64748b; margin:0; }
    .header-actions select { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:7px 12px; font-size:13px; color:#1e293b; }
    .total-cost-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:24px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; }
    .total-display { display:flex; flex-direction:column; gap:4px; }
    .total-label { font-size:12px; color:#64748b; font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
    .total-value { font-size:32px; font-weight:700; color:#0f172a; }
    .total-period { font-size:12px; color:#94a3b8; }
    .cost-vs-month { display:flex; flex-direction:column; gap:4px; }
    .cost-vs-month p { margin:0; font-size:13px; color:#64748b; }
    .breakdown-cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px; margin-bottom:16px; }
    .breakdown-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; }
    .breakdown-card.gpu { border-left:3px solid #6366f1; }
    .breakdown-card.storage { border-left:3px solid #10b981; }
    .breakdown-card.network { border-left:3px solid #f59e0b; }
    .breakdown-header { display:flex; align-items:flex-start; gap:12px; margin-bottom:16px; }
    .breakdown-icon { font-size:22px; flex-shrink:0; }
    .breakdown-header h3 { font-size:14px; font-weight:600; color:#0f172a; margin:0 0 2px; }
    .breakdown-header p { font-size:12px; color:#64748b; margin:0; }
    .breakdown-total { margin-left:auto; font-size:16px; font-weight:700; color:#0f172a; white-space:nowrap; }
    .breakdown-items { display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
    .breakdown-item { display:flex; justify-content:space-between; font-size:12px; color:#374151; }
    .breakdown-bar { height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden; margin-bottom:6px; }
    .breakdown-fill { height:100%; background:#6366f1; border-radius:3px; }
    .breakdown-percent { font-size:11px; color:#94a3b8; }
    .table-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; margin-bottom:16px; }
    .table-card h3 { font-size:15px; font-weight:600; color:#0f172a; margin:0 0 16px; }
    .table-card table { width:100%; border-collapse:collapse; }
    .table-card th { padding:10px 16px; font-size:11px; font-weight:600; text-transform:uppercase; color:#94a3b8; background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left; }
    .table-card td { padding:11px 16px; font-size:13px; color:#374151; border-bottom:1px solid #f8fafc; }
    .table-card tr:hover td { background:#f8fafc; }
    .percent-bar { height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden; display:inline-block; width:60px; margin-right:8px; vertical-align:middle; }
    .percent-fill { height:100%; background:#6366f1; border-radius:3px; }
  `]
})
export class CostBreakdownComponent implements OnInit {
  private http = inject(HttpClient);

  selectedPeriod = '30d';
  gpuHourRate    = 12.0;   // R$/hora GPU
  storageGbRate  = 0.15;   // R$/GB/mês

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
