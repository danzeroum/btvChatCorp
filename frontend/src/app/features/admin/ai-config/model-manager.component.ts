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
