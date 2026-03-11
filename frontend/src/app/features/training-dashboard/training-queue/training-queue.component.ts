import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingService, TrainingBatch } from '../training.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-training-queue',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="training-queue">
      <h1>Fila de Treinamento</h1>
      <p class="subtitle">Histórico de ciclos de fine-tuning e LoRA adapters</p>

      <div class="batches">
        <div *ngFor="let batch of batches" class="batch-card">
          <div class="batch-header">
            <div class="version-badge">{{ batch.version }}</div>
            <span class="status-badge" [class]="'status-' + batch.status">
              {{ statusLabel(batch.status) }}
            </span>
            <span class="deploy-date" *ngIf="batch.deployedAt">
              Deploy: {{ batch.deployedAt | date:'dd/MM/yyyy HH:mm' }}
            </span>
          </div>

          <div class="batch-stats">
            <div class="stat">
              <span class="value">{{ batch.totalExamples }}</span>
              <span class="label">Exemplos totais</span>
            </div>
            <div class="stat">
              <span class="value">{{ batch.positiveExamples }}</span>
              <span class="label">👍 Aprovados</span>
            </div>
            <div class="stat">
              <span class="value">{{ batch.correctedExamples }}</span>
              <span class="label">✏ Corrigidos</span>
            </div>
            <div class="stat">
              <span class="value">{{ batch.accuracy | percent:'1.1-1' }}</span>
              <span class="label">Acurácia</span>
            </div>
          </div>

          <!-- Barra de acurácia -->
          <div class="accuracy-bar">
            <div class="accuracy-fill"
              [style.width]="(batch.accuracy * 100) + '%'"
              [class.good]="batch.accuracy >= 0.7"
              [class.bad]="batch.accuracy < 0.7">
            </div>
          </div>
        </div>

        <div *ngIf="batches.length === 0" class="empty">
          <p>Nenhum ciclo de treinamento ainda.<br>Aprove exemplos suficientes para iniciar.</p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./training-queue.component.scss'],
})
export class TrainingQueueComponent implements OnInit {
  private trainingService = inject(TrainingService);
  private wsCtx = inject(WorkspaceContextService);
  batches: TrainingBatch[] = [];

  ngOnInit() {
    this.trainingService.getBatches(this.wsCtx.workspaceId).subscribe(
      (b) => (this.batches = b),
    );
  }

  statusLabel(s: string): string {
    return {
      queued: '⏳ Na fila', training: '🔄 Treinando',
      evaluating: '🔍 Avaliando', deployed: '✅ Deploy', rolled_back: '↩ Rollback',
    }[s] ?? s;
  }
}
