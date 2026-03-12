import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface LoginResponse {
  access_token: string;
  token_type: string;
}

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

        <div class="register-link">
          <span>Não tem conta? </span>
          <a routerLink="/auth/register" style="color:#6366f1">Criar conta</a>
        </div>

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
      background: #0f0f0f;
      padding: 20px;
    }
    .login-card {
      width: 100%; max-width: 400px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 16px; padding: 32px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    .login-header { text-align: center; margin-bottom: 24px; }
    .login-header h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: #f0f0f0; }
    .login-header p { font-size: 14px; color: #888; margin: 0; }
    .error-banner {
      background: #3f1010; color: #f87171; border: 1px solid #7f1d1d;
      padding: 10px 14px; border-radius: 8px; font-size: 13px;
      margin-bottom: 16px; text-align: center;
    }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block; font-size: 13px; font-weight: 500;
      margin-bottom: 6px; color: #ccc;
    }
    .form-group input {
      width: 100%; padding: 10px 12px; border-radius: 8px;
      border: 1px solid #333;
      background: #111; color: #f0f0f0;
      font-size: 14px; box-sizing: border-box;
    }
    .form-group input:focus {
      outline: none; border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    }
    .btn-login {
      width: 100%; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600;
      background: #6366f1; color: #fff; border: none; cursor: pointer;
      margin-top: 4px;
    }
    .btn-login:disabled { opacity: 0.4; cursor: not-allowed; }
    .register-link { text-align: center; margin-top: 14px; font-size: 13px; color: #888; }
    .login-footer { text-align: center; margin-top: 20px; }
    .login-footer p { font-size: 11px; color: #555; }
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

    // Formato form-urlencoded exigido pelo OAuth2PasswordRequestForm do Axum
    const body = new URLSearchParams();
    body.set('username', this.email);
    body.set('password', this.password);

    this.http.post<LoginResponse>('/api/v1/auth/login', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).subscribe({
      next: (res) => {
        localStorage.setItem('jwt_token', res.access_token);
        this.router.navigate(['/projects']);
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err.error?.message || err.error?.detail || 'Email ou senha incorretos.';
        this.errorMessage.set(msg);
      }
    });
  }
}
