import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandingConfigComponent } from '../../white-label/components/branding-config.component';
import { BrandingService } from '../../white-label/services/branding.service';
import { AuthService } from '../../auth/auth.service';

/**
 * Página admin que hospeda o painel de branding.
 * Carrega a config completa antes de renderizar o form.
 */
@Component({
  selector: 'app-branding-admin-page',
  standalone: true,
  imports: [CommonModule, BrandingConfigComponent],
  template: `
    <div class="admin-page">
      @if (loading) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Carregando configurações de branding...</p>
        </div>
      } @else if (error) {
        <div class="error-state">
          <span>⚠️</span>
          <p>{{ error }}</p>
          <button class="btn-primary" (click)="load()">Tentar novamente</button>
        </div>
      } @else {
        <app-branding-config></app-branding-config>
      }
    </div>
  `,
  styles: [`
    .admin-page { padding: 0; }
    .loading-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 80px 24px;
      color: var(--color-text-secondary, #64748b);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-border, #e2e8f0);
      border-top-color: var(--color-primary, #2563eb);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-state span { font-size: 2rem; }
  `]
})
export class BrandingAdminPageComponent implements OnInit {
  private brandingService = inject(BrandingService);
  private authService = inject(AuthService);

  loading = true;
  error: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    const workspaceId = this.authService.currentUser()?.workspaceId ?? '';
    this.brandingService.loadAdminBranding(workspaceId).subscribe({
      next: () => { this.loading = false; },
      error: () => {
        this.loading = false;
        this.error = 'Não foi possível carregar as configurações de branding.';
      },
    });
  }
}
