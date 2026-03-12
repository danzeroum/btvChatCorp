import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface RegisterResponse {
  id: string;
  email: string;
  name: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <h1>Criar Conta</h1>
          <p>Preencha os dados para se registrar</p>
        </div>

        @if (errorMessage()) {
          <div class="error-banner">{{ errorMessage() }}</div>
        }
        @if (success()) {
          <div class="success-banner">Conta criada! <a routerLink="/auth/login">Faça login →</a></div>
        }

        @if (!success()) {
          <form (ngSubmit)="register()">
            <div class="form-group">
              <label>Nome completo</label>
              <input type="text" [(ngModel)]="name" name="name" placeholder="Seu nome" required />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="email" name="email" placeholder="seu@empresa.com" required />
            </div>
            <div class="form-group">
              <label>Senha</label>
              <input type="password" [(ngModel)]="password" name="password" placeholder="Mínimo 8 caracteres" required />
            </div>
            <button type="submit" class="btn-login" [disabled]="submitting()">
              {{ submitting() ? 'Registrando...' : 'Criar Conta' }}
            </button>
          </form>
          <div style="text-align:center;margin-top:14px;font-size:13px;color:#888">
            Já tem conta? <a routerLink="/auth/login" style="color:#6366f1">Entrar</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0f0f0f; padding:20px; }
    .login-card { width:100%; max-width:400px; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:16px; padding:32px; box-shadow:0 4px 24px rgba(0,0,0,0.4); }
    .login-header { text-align:center; margin-bottom:24px; }
    .login-header h1 { font-size:22px; font-weight:700; margin:0 0 4px; color:#f0f0f0; }
    .login-header p { font-size:14px; color:#888; margin:0; }
    .error-banner { background:#3f1010; color:#f87171; border:1px solid #7f1d1d; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; text-align:center; }
    .success-banner { background:#052e16; color:#4ade80; border:1px solid #14532d; padding:12px 14px; border-radius:8px; font-size:13px; text-align:center; }
    .success-banner a { color:#4ade80; }
    .form-group { margin-bottom:16px; }
    .form-group label { display:block; font-size:13px; font-weight:500; margin-bottom:6px; color:#ccc; }
    .form-group input { width:100%; padding:10px 12px; border-radius:8px; border:1px solid #333; background:#111; color:#f0f0f0; font-size:14px; box-sizing:border-box; }
    .form-group input:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
    .btn-login { width:100%; padding:12px; border-radius:8px; font-size:14px; font-weight:600; background:#6366f1; color:#fff; border:none; cursor:pointer; margin-top:4px; }
    .btn-login:disabled { opacity:0.4; cursor:not-allowed; }
  `]
})
export class RegisterComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  name = '';
  email = '';
  password = '';
  submitting = signal(false);
  errorMessage = signal('');
  success = signal(false);

  register() {
    if (!this.name || !this.email || !this.password) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    this.http.post<RegisterResponse>('/api/v1/auth/register', {
      name: this.name,
      email: this.email,
      password: this.password,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err.error?.message || err.error?.detail || 'Erro ao criar conta.';
        this.errorMessage.set(msg);
      }
    });
  }
}
