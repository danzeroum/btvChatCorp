import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <h1>AI Platform</h1>
          <p>Acesse seu workspace</p>
        </div>

        @if (errorMessage()) {
          <div class="error-banner">{{ errorMessage() }}</div>
        }

        <form (ngSubmit)="login()">
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" type="email" [(ngModel)]="email" name="email"
                   placeholder="seu@empresa.com" autocomplete="email" required autofocus />
          </div>

          <div class="form-group">
            <label for="password">Senha</label>
            <input id="password" type="password" [(ngModel)]="password" name="password"
                   placeholder="••••••••" autocomplete="current-password" required />
          </div>

          <button type="submit" class="btn-login" [disabled]="submitting() || !email || !password">
            {{ submitting() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <div class="login-footer">
          <p>Dados hospedados no Brasil · LGPD compliant</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: var(--color-background, #f8fafc);
      padding: 20px;
    }
    .login-card {
      width: 100%; max-width: 400px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: 16px; padding: 32px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }
    .login-header { text-align: center; margin-bottom: 24px; }
    .login-header h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    .login-header p { font-size: 14px; color: var(--color-text-secondary, #666); margin: 0; }

    .error-banner {
      background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
      padding: 10px 14px; border-radius: 8px; font-size: 13px;
      margin-bottom: 16px; text-align: center;
    }

    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block; font-size: 13px; font-weight: 500;
      margin-bottom: 6px; color: var(--color-text-primary, #333);
    }
    .form-group input {
      width: 100%; padding: 10px 12px; border-radius: 8px;
      border: 1px solid var(--color-border, #d1d5db);
      font-size: 14px; box-sizing: border-box;
    }
    .form-group input:focus {
      outline: none; border-color: var(--color-primary, #6366f1);
      box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
    }

    .btn-login {
      width: 100%; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600;
      background: var(--color-primary, #6366f1); color: #fff; border: none; cursor: pointer;
      margin-top: 4px;
    }
    .btn-login:disabled { opacity: 0.4; cursor: not-allowed; }

    .login-footer { text-align: center; margin-top: 20px; }
    .login-footer p { font-size: 11px; color: var(--color-text-secondary, #aaa); }
  `]
})
export class LoginComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  email = '';
  password = '';
  submitting = signal(false);
  errorMessage = signal('');

  login() {
    if (!this.email || !this.password) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    this.http.post<{ access_token: string; refresh_token: string }>('/api/auth/login', {
      email: this.email,
      password: this.password,
    }).subscribe({
      next: (res) => {
        localStorage.setItem('jwt_token', res.access_token);
        localStorage.setItem('refresh_token', res.refresh_token);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err.error?.error?.message || 'Email ou senha incorretos.';
        this.errorMessage.set(msg);
      }
    });
  }
}