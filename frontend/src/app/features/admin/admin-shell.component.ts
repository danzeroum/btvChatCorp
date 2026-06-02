import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

interface AdminNavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
}

interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell" [class.is-collapsed]="collapsed()">
      <!-- SIDEBAR -->
      <aside class="admin-sidebar" [class.collapsed]="collapsed()">
        <!-- Brand -->
        <div class="brand-area">
          <div class="brand-logo">
            <span class="brand-mark">{{ brandInitials() }}</span>
            @if (!collapsed()) {
              <div class="brand-text">
                <span class="brand-name">{{ workspaceName() }}</span>
                <span class="plan-chip">Enterprise</span>
              </div>
            }
          </div>
          <button class="collapse-btn" (click)="collapsed.set(!collapsed())" title="Recolher menu">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path [attr.d]="collapsed() ? 'M6 3l5 5-5 5' : 'M10 3l-5 5 5 5'"
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <!-- Section label when not collapsed -->
        @if (!collapsed()) {
          <div class="admin-label">Administração</div>
        }

        <!-- Nav groups -->
        <nav class="sidebar-nav">
          <!-- Visão Geral -->
          <a routerLink="/admin/dashboard"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: true }"
             class="nav-link top-link"
             [title]="collapsed() ? 'Visão geral' : ''">
            <span class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </span>
            @if (!collapsed()) { <span class="nav-label">Visão geral</span> }
          </a>

          @for (group of navGroups; track group.title) {
            @if (!collapsed()) {
              <div class="group-title">{{ group.title }}</div>
            } @else {
              <div class="group-divider"></div>
            }
            @for (item of group.items; track item.route) {
              <a [routerLink]="item.route"
                 routerLinkActive="active"
                 [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                 class="nav-link"
                 [title]="collapsed() ? item.label : ''">
                <span class="nav-icon" [innerHTML]="item.icon"></span>
                @if (!collapsed()) { <span class="nav-label">{{ item.label }}</span> }
              </a>
            }
          }
        </nav>

        <!-- Footer: back + user -->
        <div class="sidebar-footer">
          <a routerLink="/projects" class="nav-link back-link" [title]="collapsed() ? 'Voltar ao app' : ''">
            <span class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            @if (!collapsed()) { <span class="nav-label">Voltar ao app</span> }
          </a>
          <div class="user-pill">
            <span class="user-avatar">{{ userInitials() }}</span>
            @if (!collapsed()) {
              <div class="user-info">
                <span class="user-name">{{ userName() }}</span>
                <span class="user-role">Admin · {{ workspaceName() }}</span>
              </div>
            }
          </div>
        </div>
      </aside>

      <!-- CONTENT -->
      <main class="admin-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; overflow: hidden; }

    .admin-shell {
      display: flex;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: #f8fafc;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* ─── Sidebar ─── */
    .admin-sidebar {
      width: 220px;
      min-width: 220px;
      background: #0f172a;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      border-right: 1px solid rgba(255,255,255,0.05);
      overflow-y: auto;
      overflow-x: hidden;
      flex-shrink: 0;
      transition: width 0.2s ease, min-width 0.2s ease;
    }
    .admin-sidebar.collapsed {
      width: 64px;
      min-width: 64px;
    }

    /* Brand */
    .brand-area {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 14px 12px;
      min-height: 60px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
    }
    .brand-mark {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: #6366f1;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }
    .brand-name {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .plan-chip {
      font-size: 10px;
      font-weight: 600;
      background: rgba(99,102,241,0.2);
      color: #818cf8;
      padding: 1px 7px;
      border-radius: 20px;
      width: fit-content;
      letter-spacing: 0.3px;
    }
    .collapse-btn {
      background: none;
      border: none;
      color: #475569;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      flex-shrink: 0;
      transition: color 0.12s, background 0.12s;
    }
    .collapse-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.06); }

    .admin-label {
      padding: 12px 16px 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #334155;
    }

    /* Nav */
    .sidebar-nav {
      flex: 1;
      padding: 4px 8px;
      overflow-y: auto;
    }
    .top-link { margin-bottom: 4px; }
    .group-title {
      padding: 10px 10px 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #334155;
    }
    .group-divider {
      margin: 8px 10px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 10px;
      border-radius: 8px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 450;
      transition: background 0.12s, color 0.12s;
      white-space: nowrap;
      overflow: hidden;
      margin-bottom: 1px;
    }
    .nav-link:hover { background: rgba(255,255,255,0.06); color: #cbd5e1; }
    .nav-link.active {
      background: rgba(99,102,241,0.15);
      color: #a5b4fc;
      font-weight: 500;
    }
    .nav-icon {
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      opacity: 0.85;
    }
    .nav-icon svg { width: 16px; height: 16px; }

    /* Footer */
    .sidebar-footer {
      border-top: 1px solid rgba(255,255,255,0.05);
      padding: 8px;
    }
    .back-link {
      color: #64748b;
      font-size: 12.5px;
      margin-bottom: 4px;
    }
    .back-link:hover { color: #94a3b8; }
    .user-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: default;
      overflow: hidden;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #312e81;
      color: #a5b4fc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .user-info { overflow: hidden; }
    .user-name {
      display: block;
      font-size: 12.5px;
      font-weight: 500;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-role {
      display: block;
      font-size: 11px;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ─── Content ─── */
    .admin-content {
      flex: 1;
      overflow-y: auto;
      min-width: 0;
      background: #f8fafc;
    }
  `]
})
export class AdminShellComponent {
  private authService = inject(AuthService);
  private wsCtx = inject(WorkspaceContextService);

  collapsed = signal(false);

  workspaceName = computed(() => this.wsCtx.context()?.workspaceName || 'Workspace');
  brandInitials = computed(() => (this.wsCtx.context()?.workspaceName || 'AI').slice(0, 2).toUpperCase());
  userName = computed(() => this.authService.user()?.name || 'Admin');
  userInitials = computed(() => {
    const name = this.authService.user()?.name || 'AD';
    return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  });

  navGroups: AdminNavGroup[] = [
    {
      title: 'Gestão',
      items: [
        {
          label: 'Usuários & papéis',
          route: '/admin/users',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="6" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M1.5 13.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M11 7.5c1.5 0 3 1 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="11" cy="4.5" r="1.8" stroke="currentColor" stroke-width="1.4"/>
          </svg>`,
        },
        {
          label: 'SSO & acesso',
          route: '/admin/sso',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="7" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="8" cy="11" r="1.2" fill="currentColor"/>
          </svg>`,
        },
      ],
    },
    {
      title: 'IA · MLOps',
      items: [
        {
          label: 'Modelos & LoRA',
          route: '/admin/ai-config',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <circle cx="8" cy="8" r="1.8" fill="currentColor"/>
          </svg>`,
        },
        {
          label: 'RAG / Embedding',
          route: '/admin/rag-config',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>`,
        },
      ],
    },
    {
      title: 'Governança',
      items: [
        {
          label: 'Auditoria',
          route: '/admin/audit',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="1" width="10" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M5 5h5M5 8h5M5 11h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="13" cy="13" r="2.5" fill="#0f172a" stroke="currentColor" stroke-width="1.3"/>
            <path d="M12.3 13l.5.5 1-1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
          </svg>`,
        },
        {
          label: 'Compliance LGPD',
          route: '/admin/settings',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5L2 4v4c0 3.5 2.7 6.2 6 6.9C14 14.2 14 8 14 8V4L8 1.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>`,
        },
        {
          label: 'Retenção de dados',
          route: '/admin/settings',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" stroke-width="1.4"/>
            <path d="M3 4v4c0 1.1 2.24 2 5 2s5-.9 5-2V4" stroke="currentColor" stroke-width="1.4"/>
            <path d="M3 8v4c0 1.1 2.24 2 5 2s5-.9 5-2V8" stroke="currentColor" stroke-width="1.4"/>
          </svg>`,
        },
      ],
    },
    {
      title: 'FinOps',
      items: [
        {
          label: 'Uso & custos',
          route: '/admin/billing',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="4" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M1.5 7h13" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="5" cy="10.5" r="1" fill="currentColor"/>
          </svg>`,
        },
      ],
    },
    {
      title: 'Integrações',
      items: [
        {
          label: 'API keys',
          route: '/admin/api-keys',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="5.5" cy="6.5" r="3" stroke="currentColor" stroke-width="1.4"/>
            <path d="M7.5 8.5l6 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M12 12l1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>`,
        },
        {
          label: 'Webhooks',
          route: '/admin/integrations/webhooks',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 8a2 2 0 100-4 2 2 0 000 4zM10 12a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 6l4 4M8 6L4 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>`,
        },
        {
          label: 'Marca & domínio',
          route: '/admin/branding',
          icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5M8 1.5C10 4 11 6 11 8s-1 4-3 6.5M1.5 8h13" stroke="currentColor" stroke-width="1.3"/>
          </svg>`,
        },
      ],
    },
  ];
}
