import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface TrainingBatch {
  id: string;
  version: string;
  totalExamples: number;
  positiveExamples: number;
  correctedExamples: number;
  accuracy?: number;
  status: 'queued' | 'training' | 'evaluating' | 'deployed' | 'rolled_back';
  startedAt?: string;
  deployedAt?: string;
}

@Component({
  selector: 'app-training-queue',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="training-queue">
      <div class="queue-header">
        <h3>Fila de Treinamento</h3>
        <button (click)="triggerManual()" class="trigger-btn">⚡ Iniciar treino manual</button>
      </div>

      <h4>Histórico de Batches</h4>
      <table class="batches-table">
        <thead>
          <tr>
            <th>Versão</th><th>Exemplos</th><th>Correções</th>
            <th>Acurácia</th><th>Status</th><th>Deploy</th>
          </tr>
        </thead>
        <tbody>
          @for (batch of batches; track batch.id) {
            <tr>
              <td><strong>{{ batch.version }}</strong></td>
              <td>{{ batch.totalExamples }}</td>
              <td>{{ batch.correctedExamples }}</td>
              <td>{{ batch.accuracy ? (batch.accuracy * 100).toFixed(1) + '%' : '-' }}</td>
              <td><span class="status-badge" [class]="batch.status">{{ batch.status }}</span></td>
              <td>{{ batch.deployedAt ? (batch.deployedAt | date:'dd/MM HH:mm') : '-' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class TrainingQueueComponent implements OnInit {
  private http = inject(HttpClient);
  batches: TrainingBatch[] = [];

  ngOnInit(): void {
    this.http.get<TrainingBatch[]>('/api/admin/training/batches').subscribe(b => this.batches = b);
  }

  triggerManual(): void {
    if (confirm('Iniciar ciclo de treinamento manual agora?')) {
      this.http.post('/api/admin/training/trigger', {}).subscribe(() => this.ngOnInit());
    }
  }
}
