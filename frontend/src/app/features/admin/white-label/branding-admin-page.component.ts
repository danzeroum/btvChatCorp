import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BrandingConfigComponent } from '../../white-label/components/branding-config.component';
import { BrandingService } from '../../white-label/services/branding.service';

@Component({
  selector: 'app-branding-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, BrandingConfigComponent],
  template: `
    <div class="admin-page">
      <div class="breadcrumb">
        <a [routerLink]="['/admin/dashboard']" class="bc-link">Dashboard</a>
        <span class="bc-sep">/</span>
        <span>White-label</span>
      </div>

      <div class="admin-header">
        <div>
          <h1>White-label &amp; Branding</h1>
          <p class="page-sub">Personalize cores, logotipo e aparência da plataforma</p>
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Carregando configurações de branding…</p>
        </div>
      } @else if (error) {
        <div class="error-state">
          <span class="err-icon">!</span>
          <p>{{ error }}</p>
          <button class="btn-primary" (click)="load()">Tentar novamente</button>
        </div>
      } @else {
        <app-branding-config />
      }
    </div>
  `,
  styles: [`
    .admin-page { padding: 28px 32px; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
    .breadcrumb { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-3); margin-bottom:16px; }
    .bc-link { color:var(--ink-2); text-decoration:none; }
    .bc-link:hover { color:var(--ink); }
    .bc-sep { color:var(--line); }
    .admin-header { margin-bottom:20px; }
    .admin-header h1 { font-size:20px; font-weight:600; color:var(--ink); margin:0 0 4px; }
    .page-sub { font-size:13px; color:var(--ink-3); margin:0; }
    .loading-state, .error-state {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:14px; padding:80px 24px; color:var(--ink-3);
    }
    .spinner {
      width:36px; height:36px;
      border:3px solid var(--line);
      border-top-color:var(--acc);
      border-radius:50%;
      animation:spin .8s linear infinite;
    }
    .err-icon { width:40px; height:40px; border-radius:50%; background:var(--acc-soft); color:var(--acc); font-size:18px; font-weight:700; display:flex; align-items:center; justify-content:center; }
    .btn-primary { padding:8px 18px; background:var(--acc); color:var(--white); border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
})
export class BrandingAdminPageComponent implements OnInit {
  private brandingService = inject(BrandingService);

  loading = true;
  error: string | null = null;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error   = null;
    this.brandingService.loadAdminBranding().subscribe({
      next:  () => { this.loading = false; },
      error: () => { this.loading = false; this.error = 'Não foi possível carregar as configurações de branding.'; },
    });
  }
}
