import {
  Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { interval, Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { AdminService, AiModel, LoraAdapter } from '../admin.service';
import { GaugeComponent } from '../shared/gauge.component';
import { StatusPillComponent } from '../shared/status-pill.component';

@Component({
  selector: 'app-model-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, GaugeComponent, StatusPillComponent],
  template: `
    <div class="admin-page">
      <div class="breadcrumb">
        <a [routerLink]="['/admin/dashboard']" class="bc-link">Dashboard</a>
        <span class="bc-sep">/</span>
        <span>Modelos &amp; LoRA</span>
      </div>

      <div class="admin-header">
        <div>
          <h1>Modelos &amp; LoRA Adapters</h1>
          <p class="page-sub">Gerencie modelos de inferência e adapters de fine-tuning ativos</p>
        </div>
        <button class="btn-ghost" (click)="load()" [disabled]="loading()">Atualizar</button>
      </div>

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      @if (swapping()) {
        <div class="alert-info">Promovendo adapter… aguarde alguns segundos.</div>
      }

      <!-- Production cards -->
      @if (loading()) {
        <div class="model-cards">
          @for (i of [0,1]; track i) { <div class="model-card sk-card"></div> }
        </div>
      } @else {
        <div class="model-cards">
          @for (model of models(); track model.id) {
            <div class="model-card" [class.card-active]="model.status === 'active'">
              <div class="card-left">
                <div class="card-top">
                  <span class="model-name">{{ model.display_name }}</span>
                  <app-status-pill [kind]="model.status === 'active' ? 'ok' : model.status === 'loading' ? 'warn' : 'neutral'">
                    {{ model.status === 'active' ? 'Ativo' : model.status === 'loading' ? 'Carregando' : 'Inativo' }}
                  </app-status-pill>
                </div>
                <div class="model-meta">
                  <span class="meta-item">Base: <span class="mono">{{ model.base_model }}</span></span>
                  <span class="meta-item">Latência: <span class="mono">{{ model.avg_latency_ms }}ms</span></span>
                  <span class="meta-item">{{ model.requests_per_minute }} rpm</span>
                </div>
                @if (model.active_lora_version) {
                  <div class="lora-badge">
                    LoRA ativo: <span class="mono">{{ model.active_lora_version }}</span>
                  </div>
                }
                <div class="card-actions">
                  <button class="btn-sm btn-ghost" (click)="setDefault(model)" [disabled]="busy()">
                    Definir padrão
                  </button>
                  <button class="btn-sm btn-ghost" (click)="reload(model)" [disabled]="busy()">
                    Recarregar
                  </button>
                </div>
              </div>
              <div class="card-right">
                <app-gauge [value]="model.gpu_utilization" sub="GPU" [color]="gpuColor(model.gpu_utilization)" />
              </div>
            </div>
          }
        </div>
      }

      <!-- LoRA Adapters -->
      <div class="section-card">
        <div class="section-head">
          <h2>LoRA Adapters</h2>
        </div>

        @if (loading()) {
          <div class="loading-hint">Carregando adapters…</div>
        } @else if (adapters().length === 0) {
          <div class="empty-hint">Nenhum adapter disponível. Complete um ciclo de treinamento.</div>
        } @else {
          <div class="lora-grid">
            <div class="lora-head">
              <span>Versão</span>
              <span>Treinado</span>
              <span class="align-right">Exemplos</span>
              <span class="align-right">Loss</span>
              <span class="align-right">Acurácia</span>
              <span class="align-right">Δ</span>
              <span>Status</span>
              <span>Ações</span>
            </div>
            @for (adapter of adapters(); track adapter.version) {
              <div class="lora-row" [class.row-deprecated]="adapter.status === 'deprecated'">
                <span class="mono fw-600">{{ adapter.version }}</span>
                <span class="mono ink-3">{{ adapter.trained_at | date:'dd/MM/yy HH:mm' }}</span>
                <span class="align-right mono">{{ adapter.training_examples | number }}</span>
                <span class="align-right mono">{{ adapter.training_loss.toFixed(4) }}</span>
                <span class="align-right mono">{{ adapter.eval_accuracy | percent:'1.1-1' }}</span>
                <span class="align-right mono" [class.delta-pos]="(adapter.improvement_vs_previous ?? 0) > 0"
                      [class.delta-neg]="(adapter.improvement_vs_previous ?? 0) < 0">
                  @if (adapter.improvement_vs_previous != null) {
                    {{ adapter.improvement_vs_previous > 0 ? '+' : '' }}{{ (adapter.improvement_vs_previous * 100).toFixed(1) }}%
                  } @else { — }
                </span>
                <span>
                  <app-status-pill [kind]="loraKind(adapter.status)">{{ loraLabel(adapter.status) }}</app-status-pill>
                </span>
                <span class="lora-actions">
                  @if (adapter.status === 'ready') {
                    <select class="model-select mono" [(ngModel)]="selectedModelId" aria-label="Selecionar modelo">
                      <option value="">Modelo…</option>
                      @for (m of models(); track m.id) {
                        <option [value]="m.id">{{ m.display_name }}</option>
                      }
                    </select>
                    <button class="btn-sm btn-accent" (click)="activateAdapter(adapter)"
                            [disabled]="!selectedModelId || busy()">Promover</button>
                  }
                  @if (adapter.status === 'active') {
                    <span class="active-tag">Em produção</span>
                  }
                  @if (adapter.status === 'deprecated') {
                    <button class="btn-sm btn-ghost" (click)="activateAdapter(adapter)"
                            [disabled]="!selectedModelId || busy()">Restaurar</button>
                  }
                </span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .admin-page { padding: 28px 32px; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
    .breadcrumb { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-3); margin-bottom:16px; }
    .bc-link { color:var(--ink-2); text-decoration:none; }
    .bc-link:hover { color:var(--ink); }
    .bc-sep { color:var(--line); }
    .admin-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .admin-header h1 { font-size:20px; font-weight:600; color:var(--ink); margin:0 0 4px; }
    .page-sub { font-size:13px; color:var(--ink-3); margin:0; }
    .btn-ghost { background:none; border:1px solid var(--line); border-radius:8px; padding:7px 16px; font-size:13px; color:var(--ink-2); cursor:pointer; }
    .btn-ghost:hover { background:var(--panel-2); }
    .btn-ghost:disabled { opacity:.5; cursor:not-allowed; }
    .btn-accent { background:var(--acc); color:var(--white); border:none; border-radius:6px; padding:5px 12px; font-size:12px; cursor:pointer; }
    .btn-accent:disabled { opacity:.5; cursor:not-allowed; }
    .btn-sm { padding:5px 12px; border-radius:6px; font-size:12px; }
    .alert-error { background:var(--acc-soft); color:var(--acc); border:1px solid var(--acc-line); border-radius:8px; padding:10px 16px; font-size:13px; margin-bottom:16px; }
    .alert-info { background:#edf5ff; color:#1a5fb4; border:1px solid #c0d9f9; border-radius:8px; padding:10px 16px; font-size:13px; margin-bottom:16px; }
    .model-cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(420px, 1fr)); gap:12px; margin-bottom:16px; }
    .model-card { background:var(--white); border:1px solid var(--line); border-radius:10px; padding:20px 24px; display:flex; gap:20px; align-items:flex-start; }
    .card-active { border-left:3px solid var(--good); }
    .card-left { flex:1; display:flex; flex-direction:column; gap:10px; }
    .card-right { flex-shrink:0; }
    .card-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .model-name { font-size:15px; font-weight:600; color:var(--ink); }
    .model-meta { display:flex; flex-wrap:wrap; gap:10px; }
    .meta-item { font-size:12px; color:var(--ink-2); }
    .lora-badge { font-size:12px; color:var(--acc); background:var(--acc-soft); border-radius:6px; padding:3px 10px; display:inline-block; }
    .card-actions { display:flex; gap:8px; }
    .sk-card { min-height:120px; border-radius:10px; background:var(--line-2); animation:shimmer 1.4s infinite; }
    @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.4} }
    .section-card { background:var(--white); border:1px solid var(--line); border-radius:10px; padding:20px 24px; }
    .section-head { margin-bottom:16px; }
    .section-head h2 { font-size:15px; font-weight:600; color:var(--ink); margin:0; }
    .loading-hint, .empty-hint { text-align:center; padding:40px; font-size:13px; color:var(--ink-3); }
    .lora-grid { display:grid; grid-template-columns: minmax(80px,auto) minmax(110px,auto) 70px 70px 80px 55px 100px 1fr; gap:0; }
    .lora-head { display:contents; }
    .lora-head > span { padding:9px 12px; font-size:11px; font-weight:600; color:var(--ink-3); border-bottom:1px solid var(--line); background:var(--panel-2); }
    .lora-row { display:contents; }
    .lora-row > span { padding:10px 12px; font-size:12.5px; color:var(--ink); border-bottom:1px solid var(--line-2); }
    .lora-row:last-child > span { border-bottom:none; }
    .lora-row:hover > span { background:var(--panel-2); }
    .row-deprecated > span { opacity:.55; }
    .align-right { text-align:right; }
    .mono { font-family:'IBM Plex Mono', monospace; }
    .fw-600 { font-weight:600; }
    .ink-3 { color:var(--ink-3); }
    .delta-pos { color:var(--good); }
    .delta-neg { color:var(--acc); }
    .lora-actions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .model-select { background:var(--white); border:1px solid var(--line); border-radius:6px; padding:4px 8px; font-size:11.5px; color:var(--ink); max-width:120px; }
    .active-tag { font-size:11.5px; color:var(--good); font-weight:500; }
  `],
})
export class ModelManagerComponent implements OnInit, OnDestroy {
  private adminSvc = inject(AdminService);
  private destroy$ = new Subject<void>();

  models          = signal<AiModel[]>([]);
  adapters        = signal<LoraAdapter[]>([]);
  loading         = signal(true);
  busy            = signal(false);
  swapping        = signal(false);
  error           = signal<string | null>(null);
  selectedModelId = '';

  ngOnInit(): void {
    this.load();
    interval(30_000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.adminSvc.listAiModels()),
    ).subscribe(m => this.models.set(m));
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminSvc.listAiModels().subscribe({
      next: (models) => { this.models.set(models); this.loadAdapters(); },
      error: () => { this.error.set('Erro ao carregar modelos.'); this.loading.set(false); },
    });
  }

  private loadAdapters(): void {
    this.adminSvc.listLoraAdapters().subscribe({
      next: (adapters) => { this.adapters.set(adapters); this.loading.set(false); },
      error: () => { this.error.set('Erro ao carregar LoRA adapters.'); this.loading.set(false); },
    });
  }

  activateAdapter(adapter: LoraAdapter): void {
    if (!this.selectedModelId) return;
    this.busy.set(true);
    this.swapping.set(true);
    this.adminSvc.activateLoraAdapter({ model_id: this.selectedModelId, lora_version: adapter.version }).subscribe({
      next: () => { this.busy.set(false); this.swapping.set(false); this.selectedModelId = ''; this.load(); },
      error: (err) => { this.busy.set(false); this.swapping.set(false); this.error.set(err?.error?.message ?? 'Erro ao ativar adapter.'); },
    });
  }

  setDefault(model: AiModel): void {
    this.busy.set(true);
    this.adminSvc.setDefaultModel(model.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (err) => { this.busy.set(false); this.error.set(err?.error?.message ?? 'Erro ao definir modelo padrão.'); },
    });
  }

  reload(model: AiModel): void {
    this.busy.set(true);
    this.adminSvc.reloadModel(model.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (err) => { this.busy.set(false); this.error.set(err?.error?.message ?? 'Erro ao recarregar modelo.'); },
    });
  }

  gpuColor(pct: number): string {
    if (pct >= 85) return 'var(--acc)';
    if (pct >= 65) return 'var(--warn)';
    return 'var(--good)';
  }

  loraKind(status: string): 'ok' | 'warn' | 'bad' | 'neutral' {
    return status === 'active' ? 'ok' : status === 'ready' ? 'ok' : status === 'pending' ? 'warn' : 'neutral';
  }

  loraLabel(status: string): string {
    return { pending: 'Pendente', ready: 'Pronto', active: 'Ativo', deprecated: 'Obsoleto' }[status] ?? status;
  }
}
