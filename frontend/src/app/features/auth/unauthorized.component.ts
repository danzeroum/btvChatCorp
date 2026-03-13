import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  template: `
    <div class="page">
      <div class="card">
        <div class="icon">🚫</div>
        <h1>Acesso negado</h1>
        <p>Você não tem permissão para acessar esta área.</p>
        <p class="hint">Esta seção exige perfil de <strong>administrador</strong>.</p>
        <button (click)="goBack()">← Voltar ao início</button>
      </div>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh;
      background: #0f0f0f;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 3rem 2.5rem;
      text-align: center;
      max-width: 420px;
      color: #f0f0f0;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p  { color: #999; font-size: 0.9rem; margin: 0.4rem 0; line-height: 1.5; }
    .hint { margin-top: 0.75rem; }
    strong { color: #f0f0f0; }
    button {
      margin-top: 2rem;
      padding: 10px 24px;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: background 0.15s;
    }
    button:hover { background: #4f46e5; }
  `]
})
export class UnauthorizedComponent {
  constructor(private router: Router) {}
  goBack() { this.router.navigate(['/projects']); }
}
