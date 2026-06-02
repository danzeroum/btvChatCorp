import {
  Component, OnInit, OnDestroy, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { AdminService, AiModel, LoraAdapter } from '../admin.service';

@Component({
  selector: 'app-model-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="model-manager">
      <div class="page-header">
        <h1>Gerenciamento de Modelos</h1>
        <p class="subtitle">Modelos de IA ativos e LoRA adapters disponíveis</p>
        <button class="btn-secondary" (click)="load()" [disabled]="loading()">
          🔄 Atualizar
        </button>
      </div>

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      <!-- Modelos ativos -->
      <section class="section">
        <h2>Modelos de Inferência</h2>
        @if (loading()) {
          <div class="loading">Carregando modelos...</div>
        } @else if (models().length === 0) {
          <div class="empty-state">Nenhum modelo configurado.</div>
        } @else {
          <div class="models-grid">
            @for (model of models(); track model.id) {
              <div class="model-card" [class]="'status-' + model.status">
                <div class="model-header">
                  <div class="model-name">{{ model.display_name }}</div>
                  <span class="status-badge" [class]="model.status">
                    {{ statusLabel(model.status) }}
                  </span>
                </div>

                <div class="model-meta">
                  <span class="meta-item">🧠 {{ model.base_model }}</span>
                  <span class="meta-item">⚡ {{ model.avg_latency_ms }}ms</span>
                  <span class="meta-item">📈 {{ model.gpu_utilization }}% GPU</span>
                  <span class="meta-item">🔁 {{ model.requests_per_minute }} rpm</span>
                </div>

                @if (model.active_lora_version) {
                  <div class="lora-active">
                    🧬 LoRA ativo: <strong>{{ model.active_lora_version }}</strong>
                  </div>
                }

                <div class="model-actions">
                  <button
                    class="btn-sm btn-primary"
                    (click)="setDefault(model)"
                    [disabled]="busy()">
                    Definir padrão
                  </button>
                  <button
                    class="btn-sm"
                    (click)="reload(model)"
                    [disabled]="busy()">
                    Recarregar
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- LoRA Adapters -->
      <section class="section">
        <h2>LoRA Adapters</h2>

        @if (adapters().length === 0 && !loading()) {
          <div class="empty-state">
            <p>Nenhum LoRA adapter disponível.</p>
            <p>Complete um ciclo de treinamento para gerar adapters.</p>
          </div>
        } @else {
          <table class="adapters-table">
            <thead>
              <tr>
                <th>Versão</th>
                <th>Treinado em</th>
                <th>Exemplos</th>
                <th>Loss</th>
                <th>Acurácia</th>
                <th>Δ Melhoria</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (adapter of adapters(); track adapter.version) {
                <tr [class]="'row-' + adapter.status">
                  <td><strong>{{ adapter.version }}</strong></td>
                  <td>{{ adapter.trained_at | date:'dd/MM/yy HH:mm' }}</td>
                  <td>{{ adapter.training_examples }}</td>
                  <td>{{ adapter.training_loss.toFixed(4) }}</td>
                  <td>{{ adapter.eval_accuracy | percent:'1.1-1' }}</td>
                  <td>
                    @if (adapter.improvement_vs_previous != null) {
                      <span
                        [class.positive]="adapter.improvement_vs_previous > 0"
                        [class.negative]="adapter.improvement_vs_previous < 0">
                        {{ adapter.improvement_vs_previous > 0 ? '+' : '' }}{{ (adapter.improvement_vs_previous * 100).toFixed(1) }}%
                      </span>
                    } @else {
                      <span class="base">— base</span>
                    }
                  </td>
                  <td>
                    <span class="lora-status" [class]="adapter.status">
                      {{ loraStatusLabel(adapter.status) }}
                    </span>
                  </td>
                  <td>
                    @if (adapter.status === 'ready') {
                      <select
                        class="model-select"
                        [(ngModel)]="selectedModelId"
                        [attr.aria-label]="'Selecionar modelo para ' + adapter.version">
                        <option value="">Modelo...</option>
                        @for (m of models(); track m.id) {
                          <option [value]="m.id">{{ m.display_name }}</option>
                        }
                      </select>
                      <button
                        class="btn-sm btn-primary"
                        (click)="activateAdapter(adapter)"
                        [disabled]="!selectedModelId || busy()">
                        Ativar
                      </button>
                    }
                    @if (adapter.status === 'active') {
                      <span class="active-indicator">✅ Ativo</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display:block; font-family: Inter, system-ui, sans-serif; }
    .model-manager { padding: 28px 32px; background: #f8fafc; min-height: 100vh; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
    .page-header h1 { font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .subtitle { font-size:13px; color:#64748b; margin:0; }
    .alert-error { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:8px; padding:10px 16px; margin-bottom:16px; font-size:13px; }
    .section { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; margin-bottom:16px; }
    .section h2 { font-size:15px; font-weight:600; color:#0f172a; margin:0 0 16px; }
    .loading { text-align:center; padding:40px; color:#94a3b8; font-size:14px; }
    .empty-state { text-align:center; padding:40px; color:#94a3b8; font-size:14px; }
    .models-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px; }
    .model-card { border:1px solid #e2e8f0; border-radius:10px; padding:16px; background:#f8fafc; }
    .model-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .model-name { font-size:14px; font-weight:600; color:#0f172a; }
    .status-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:500; }
    .status-badge.active { background:#dcfce7; color:#15803d; }
    .status-badge.inactive { background:#f1f5f9; color:#64748b; }
    .status-badge.loading { background:#fef3c7; color:#92400e; }
    .model-meta { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
    .meta-item { font-size:12px; color:#64748b; background:#f1f5f9; border-radius:6px; padding:3px 8px; }
    .lora-active { font-size:12px; color:#6366f1; background:#eef2ff; border-radius:6px; padding:4px 10px; margin-bottom:10px; }
    .model-actions { display:flex; gap:8px; }
    .btn-sm { padding:5px 12px; border-radius:6px; font-size:12px; cursor:pointer; border:1px solid #e2e8f0; background:#f1f5f9; color:#374151; }
    .btn-primary { padding:8px 18px; background:#6366f1; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
    .btn-primary:hover { background:#4f46e5; }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-sm.btn-primary { padding:5px 12px; font-size:12px; }
    .btn-secondary { background:#f1f5f9; color:#374151; border:1px solid #e2e8f0; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; }
    .adapters-table { width:100%; border-collapse:collapse; }
    .adapters-table th { padding:10px 16px; font-size:11px; font-weight:600; text-transform:uppercase; color:#94a3b8; background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left; }
    .adapters-table td { padding:11px 16px; font-size:13px; color:#374151; border-bottom:1px solid #f8fafc; }
    .adapters-table tr:hover td { background:#f8fafc; }
    .lora-status { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:500; }
    .lora-status.pending { background:#fef3c7; color:#92400e; }
    .lora-status.ready { background:#dcfce7; color:#15803d; }
    .lora-status.active { background:#dbeafe; color:#1d4ed8; }
    .lora-status.deprecated { background:#fee2e2; color:#991b1b; }
    .positive { color:#15803d; font-weight:500; }
    .negative { color:#991b1b; font-weight:500; }
    .base { color:#94a3b8; }
    .model-select { background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; font-size:12px; color:#1e293b; margin-right:6px; }
    .active-indicator { font-size:12px; color:#15803d; }
  `],
})
export class ModelManagerComponent implements OnInit, OnDestroy {
  private adminSvc  = inject(AdminService);
  private destroy$  = new Subject<void>();

  models   = signal<AiModel[]>([]);
  adapters = signal<LoraAdapter[]>([]);
  loading  = signal(true);
  busy     = signal(false);
  error    = signal<string | null>(null);
  selectedModelId = '';

  ngOnInit(): void {
    this.load();
    // Polling leve a cada 30s para atualizar GPU utilization e latencia
    interval(30_000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.adminSvc.listAiModels()),
    ).subscribe(m => this.models.set(m));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminSvc.listAiModels().subscribe({
      next: models => {
        this.models.set(models);
        this.loadAdapters();
      },
      error: () => {
        this.error.set('Erro ao carregar modelos.');
        this.loading.set(false);
      },
    });
  }

  private loadAdapters(): void {
    this.adminSvc.listLoraAdapters().subscribe({
      next: adapters => {
        this.adapters.set(adapters);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erro ao carregar LoRA adapters.');
        this.loading.set(false);
      },
    });
  }

  activateAdapter(adapter: LoraAdapter): void {
    if (!this.selectedModelId) return;
    this.busy.set(true);
    this.adminSvc.activateLoraAdapter({
      model_id: this.selectedModelId,
      lora_version: adapter.version,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.selectedModelId = '';
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'Erro ao ativar adapter.');
      },
    });
  }

  setDefault(model: AiModel): void {
    this.busy.set(true);
    this.adminSvc.setDefaultModel(model.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'Erro ao definir modelo padrão.');
      },
    });
  }

  reload(model: AiModel): void {
    this.busy.set(true);
    this.adminSvc.reloadModel(model.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'Erro ao recarregar modelo.');
      },
    });
  }

  statusLabel(s: string): string {
    return { active: '✅ Ativo', inactive: '⏸ Inativo', loading: '⏳ Carregando' }[s] ?? s;
  }

  loraStatusLabel(s: string): string {
    return {
      pending:    '⏳ Pendente',
      ready:      '✅ Pronto',
      active:     '🟢 Ativo',
      deprecated: '🔴 Obsoleto',
    }[s] ?? s;
  }
}
