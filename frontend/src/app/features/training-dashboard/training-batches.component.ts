import {
  Component, OnInit, OnDestroy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { TrainingService, TrainingBatch, BatchStatus } from './training.service';

@Component({
  selector: 'app-training-batches',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="training-batches">
      <div class="page-header">
        <h2>Ciclos de Treinamento</h2>
        <button
          class="btn-primary"
          (click)="startBatch()"
          [disabled]="starting()"
        >
          {{ starting() ? 'Iniciando...' : '+ Iniciar Treino' }}
        </button>
      </div>

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      <!-- Batch ativo com polling -->
      @if (activePoll()) {
        <div class="batch-progress-card">
          <div class="batch-progress-header">
            <span class="status-badge running">Em andamento</span>
            <span class="batch-model">{{ activePoll()!.id }}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              [style.width.%]="activePoll()!.progress ?? 0"
            ></div>
          </div>
          <div class="progress-meta">
            <span>Progresso: {{ activePoll()!.progress ?? 0 }}%</span>
            <span>Epoch {{ activePoll()!.current_epoch ?? 0 }} / {{ activePoll()!.total_epochs ?? 0 }}</span>
            @if (activePoll()!.training_loss) {
              <span>Loss: {{ activePoll()!.training_loss!.toFixed(4) }}</span>
            }
          </div>
          <button class="btn-secondary" (click)="stopPoll()">Parar polling</button>
        </div>
      }

      <!-- Lista de batches -->
      <div class="batches-list">
        @if (loading()) {
          <div class="loading">Carregando...</div>
        } @else if (batches().length === 0) {
          <div class="empty-state">
            <p>Nenhum ciclo de treinamento encontrado.</p>
            <p>Inicie um treino após aprovar exemplos na fila de curadoria.</p>
          </div>
        } @else {
          @for (batch of batches(); track batch.id) {
            <div class="batch-card" [class]="batch.status">
              <div class="batch-header">
                <span class="status-badge" [class]="batch.status">
                  {{ statusLabel(batch.status) }}
                </span>
                <span class="batch-model">{{ batch.base_model }}</span>
                <span class="batch-date">{{ batch.created_at | date:'dd/MM/yy HH:mm' }}</span>
              </div>
              <div class="batch-stats">
                <span>{{ batch.total_examples ?? 0 }} exemplos</span>
                @if (batch.training_loss) {
                  <span>Loss: {{ batch.training_loss.toFixed(4) }}</span>
                }
                @if (batch.eval_accuracy) {
                  <span>Acc: {{ (batch.eval_accuracy * 100).toFixed(1) }}%</span>
                }
              </div>
              @if (batch.status === 'running' || batch.status === 'queued') {
                <button
                  class="btn-sm"
                  (click)="watchBatch(batch)"
                >
                  Monitorar
                </button>
              }
              @if (batch.error_message) {
                <p class="batch-error">{{ batch.error_message }}</p>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class TrainingBatchesComponent implements OnInit, OnDestroy {
  private svc     = inject(TrainingService);
  private stopPoll$ = new Subject<void>();

  batches  = signal<TrainingBatch[]>([]);
  loading  = signal(true);
  starting = signal(false);
  error    = signal<string | null>(null);
  activePoll = signal<BatchStatus | null>(null);

  readonly activeCount = computed(
    () => this.batches().filter(b => b.status === 'running' || b.status === 'queued').length,
  );

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.stopPoll$.next();
    this.stopPoll$.complete();
  }

  load(): void {
    this.loading.set(true);
    this.svc.getBatches().subscribe({
      next:  b  => { this.batches.set(b); this.loading.set(false); },
      error: () => { this.error.set('Erro ao carregar batches.'); this.loading.set(false); },
    });
  }

  startBatch(): void {
    this.starting.set(true);
    this.error.set(null);
    this.svc.startBatch({ base_model: 'llama3.1:8b', total_epochs: 3 }).subscribe({
      next: batch => {
        this.starting.set(false);
        this.batches.update(prev => [batch, ...prev]);
        this.watchBatch(batch);
      },
      error: (err) => {
        this.starting.set(false);
        const msg = err?.error?.message ?? 'Erro ao iniciar treinamento.';
        this.error.set(msg);
      },
    });
  }

  watchBatch(batch: TrainingBatch): void {
    this.stopPoll$.next(); // para poll anterior
    const stop$ = new Subject<void>();
    this.svc.pollBatchStatus(batch.id, 3000, stop$).subscribe({
      next: status => {
        this.activePoll.set(status);
        if (status.status === 'completed' || status.status === 'failed') {
          stop$.next();
          this.activePoll.set(null);
          this.load(); // recarrega lista
        }
      },
    });
  }

  stopPoll(): void {
    this.stopPoll$.next();
    this.activePoll.set(null);
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending:   'Pendente',
      queued:    'Na fila',
      running:   'Treinando',
      completed: 'Concluído',
      failed:    'Falhou',
      cancelled: 'Cancelado',
    };
    return map[status] ?? status;
  }
}
