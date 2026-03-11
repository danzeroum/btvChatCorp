import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, SystemHealth } from '../admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-dashboard">
      <h1>Painel Administrativo</h1>

      <!-- Saúde do sistema -->
      <div class="health-card" *ngIf="health">
        <div class="health-header">
          <span class="health-dot" [class.healthy]="health.status === 'healthy'"></span>
          <strong>{{ health.status === 'healthy' ? 'Sistema saudável' : 'Sistema degradado' }}</strong>
          <span class="uptime">Uptime {{ health.uptimePercent | number:'1.2-2' }}%</span>
          <span class="latency">Latência média {{ health.avgLatencyMs }}ms</span>
        </div>
        <div class="services">
          <div class="svc" [class.ok]="health.api === 'healthy'">
            <span class="dot"></span>API
          </div>
          <div class="svc" [class.ok]="health.database === 'healthy'">
            <span class="dot"></span>PostgreSQL
          </div>
          <div class="svc" [class.ok]="health.vectorDb === 'healthy'">
            <span class="dot"></span>Qdrant
          </div>
          <div class="svc" [class.ok]="health.gpu === 'healthy'">
            <span class="dot"></span>GPU / vLLM
          </div>
          <div class="svc" [class.ok]="health.embedding === 'healthy'">
            <span class="dot"></span>Embedding
          </div>
        </div>
      </div>

      <!-- Navegação rápida -->
      <div class="quick-nav">
        <a routerLink="../users" class="nav-card">
          <span class="icon">👥</span>
          <span class="title">Usuários</span>
          <span class="desc">Convite, roles, suspensão</span>
        </a>
        <a routerLink="../audit" class="nav-card">
          <span class="icon">🔍</span>
          <span class="title">Auditoria</span>
          <span class="desc">Logs de acesso e ações</span>
        </a>
        <a routerLink="../settings" class="nav-card">
          <span class="icon">⚙️</span>
          <span class="title">Configurações</span>
          <span class="desc">LGPD, retenção, MFA</span>
        </a>
        <a routerLink="../api-keys" class="nav-card">
          <span class="icon">🔑</span>
          <span class="title">API Keys</span>
          <span class="desc">Integrações externas</span>
        </a>
        <a routerLink="../sso" class="nav-card">
          <span class="icon">🔐</span>
          <span class="title">SSO</span>
          <span class="desc">Google, Microsoft, SAML</span>
        </a>
      </div>
    </div>
  `,
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminService);
  health: SystemHealth | null = null;

  ngOnInit() {
    this.adminService.getSystemHealth().subscribe((h) => (this.health = h));
  }
}
