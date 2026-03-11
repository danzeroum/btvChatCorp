import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-training-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <h1>Training Dashboard</h1>
      <div class="stats">
        <div class="card">
          <h3>Status</h3>
          <p class="value idle">Idle</p>
        </div>
        <div class="card">
          <h3>Próximo ciclo</h3>
          <p class="value">Domingo 03:00</p>
        </div>
        <div class="card">
          <h3>Amostras pendentes</h3>
          <p class="value">0</p>
        </div>
      </div>
      <p class="hint">O treinamento incremental de LoRA é executado automaticamente a cada semana.</p>
    </div>
  `,
  styles: [`
    .page { padding: 2rem; }
    h1 { margin-bottom: 1.5rem; }
    .stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .card { background: #1e1e1e; border-radius: 8px; padding: 1.5rem; min-width: 180px; }
    .card h3 { font-size: 0.85rem; color: #888; margin-bottom: 0.5rem; }
    .value { font-size: 1.5rem; font-weight: bold; }
    .idle { color: #22c55e; }
    .hint { color: #666; font-size: 0.9rem; }
  `]
})
export class TrainingDashboardComponent {}
