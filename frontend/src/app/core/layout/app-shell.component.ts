// src/app/core/layout/app-shell.component.ts

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { WorkspaceContextService } from '../services/workspace-context.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

interface ProjectItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  unread: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" [class.sidebar-collapsed]="collapsed()">
      
      <!-- SIDEBAR -->
      <aside class="sidebar">
        
        <!-- Logo -->
        <div class="sidebar-brand">
          @if (!collapsed()) {
            <img [src]="branding()?.logoUrl || 'assets/logo.svg'" 
                 class="brand-logo" alt="Logo" />
          } @else {
            <span class="brand-mark">{{ brandInitials() }}</span>
          }
          <button class="collapse-btn" (click)="collapsed.set(!collapsed())">
            {{ collapsed() ? '→' : '←' }}
          </button>
        </div>

        <!-- Busca global -->
        @if (!collapsed()) {
          <div class="sidebar-search">
            <input type="text" 
                   placeholder="Buscar... (⌘K)" 
                   (focus)="openSearch()"
                   readonly />
          </div>
        }

        <!-- Nav principal -->
        <nav class="sidebar-nav">
          @for (item of mainNav; track item.route) {
            <a [routerLink]="item.route" 
               routerLinkActive="active"
               [routerLinkActiveOptions]="{ exact: item.route === '/chat' }"
               class="nav-link">
              <span class="nav-icon">{{ item.icon }}</span>
              @if (!collapsed()) {
                <span class="nav-label">{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        <!-- Projetos -->
        <div class="sidebar-section">
          @if (!collapsed()) {
            <div class="section-header">
              <span class="section-title">Projetos</span>
              <button class="section-action" routerLink="/projects/new" title="Novo projeto">+</button>
            </div>
          }
          <div class="project-list">
            @for (project of projects(); track project.id) {
              <a [routerLink]="['/projects', project.id]" 
                 routerLinkActive="active"
                 class="project-link">
                <span class="project-dot" [style.background]="project.color"></span>
                @if (!collapsed()) {
                  <span class="project-icon">{{ project.icon }}</span>
                  <span class="project-name">{{ project.name }}</span>
                  @if (project.unread > 0) {
                    <span class="unread-badge">{{ project.unread }}</span>
                  }
                }
              </a>
            }
          </div>
        </div>

        <!-- Footer: workspace + user -->
        <div class="sidebar-footer">
          <a routerLink="/admin" routerLinkActive="active" class="nav-link">
            <span class="nav-icon">⚙️</span>
            @if (!collapsed()) { <span class="nav-label">Admin</span> }
          </a>
          <div class="user-pill" (click)="toggleUserMenu()">
            <span class="user-avatar">{{ userInitials() }}</span>
            @if (!collapsed()) {
              <div class="user-info">
                <span class="user-name">{{ userName() }}</span>
                <span class="workspace-name">{{ workspaceName() }}</span>
              </div>
            }
          </div>
        </div>
      </aside>

      <!-- MAIN CONTENT -->
      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--color-background, #fafafa);
      color: var(--color-text-primary, #1a1a2e);
      font-family: var(--font-family, 'Inter', system-ui, sans-serif);
    }

    /* ── Sidebar ── */
    .sidebar {
      width: 260px;
      background: var(--color-sidebar-bg, #0f172a);
      color: var(--color-sidebar-text, #cbd5e1);
      display: flex;
      flex-direction: column;
      border-right: 1px solid rgba(255,255,255,0.06);
      transition: width 0.2s ease;
      overflow-y: auto;
      overflow-x: hidden;
      flex-shrink: 0;
    }
    .sidebar-collapsed .sidebar { width: 64px; }

    .sidebar-brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      min-height: 56px;
    }
    .brand-logo { height: 28px; object-fit: contain; }
    .brand-mark {
      width: 32px; height: 32px;
      border-radius: 8px;
      background: var(--color-primary, #6366f1);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px;
    }
    .collapse-btn {
      background: none; border: none; color: inherit;
      cursor: pointer; opacity: 0.4; font-size: 14px;
      padding: 4px 6px; border-radius: 4px;
    }
    .collapse-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }

    .sidebar-search {
      padding: 0 12px 8px;
    }
    .sidebar-search input {
      width: 100%;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .sidebar-search input::placeholder { color: rgba(255,255,255,0.35); }

    /* Nav links */
    .sidebar-nav { padding: 4px 8px; }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      color: inherit;
      text-decoration: none;
      font-size: 14px;
      transition: background 0.12s;
      white-space: nowrap;
    }
    .nav-link:hover { background: rgba(255,255,255,0.06); }
    .nav-link.active {
      background: rgba(255,255,255,0.1);
      color: #fff;
      font-weight: 500;
    }
    .nav-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; }

    /* Seção de projetos */
    .sidebar-section { padding: 12px 8px 4px; flex: 1; }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 12px 6px;
    }
    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.5;
      font-weight: 600;
    }
    .section-action {
      background: none; border: none; color: inherit;
      cursor: pointer; font-size: 16px; opacity: 0.5;
      width: 22px; height: 22px; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
    }
    .section-action:hover { opacity: 1; background: rgba(255,255,255,0.08); }

    .project-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 6px;
      color: inherit;
      text-decoration: none;
      font-size: 13px;
      transition: background 0.12s;
    }
    .project-link:hover { background: rgba(255,255,255,0.06); }
    .project-link.active { background: rgba(255,255,255,0.1); color: #fff; }
    .project-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .project-icon { font-size: 14px; }
    .project-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
    .unread-badge {
      background: var(--color-primary, #6366f1);
      color: #fff;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
      font-weight: 600;
    }

    /* Footer */
    .sidebar-footer {
      padding: 8px;
      border-top: 1px solid rgba(255,255,255,0.06);
      margin-top: auto;
    }
    .user-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.12s;
      margin-top: 4px;
    }
    .user-pill:hover { background: rgba(255,255,255,0.06); }
    .user-avatar {
      width: 32px; height: 32px;
      border-radius: 8px;
      background: var(--color-primary, #6366f1);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .user-info { overflow: hidden; }
    .user-name { display: block; font-size: 13px; font-weight: 500; color: #fff; }
    .workspace-name { display: block; font-size: 11px; opacity: 0.5; }

    /* ── Main content ── */
    .main-content {
      flex: 1;
      overflow-y: auto;
      min-width: 0;
    }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .sidebar { position: fixed; z-index: 50; left: -260px; transition: left 0.25s; }
      .sidebar-collapsed .sidebar { left: -64px; }
      .sidebar.open { left: 0; }
      .main-content { width: 100%; }
    }
  `]
})
export class AppShellComponent {
  private wsCtx = inject(WorkspaceContextService);
  private router = inject(Router);
  
  collapsed = signal(false);
  projects = signal<ProjectItem[]>([]);

  mainNav: NavItem[] = [
    { label: 'Chat', icon: '💬', route: '/chat' },
    { label: 'Documentos', icon: '📄', route: '/documents' },
    { label: 'Treinamento', icon: '🧠', route: '/training' },
  ];

  branding = this.wsCtx.branding;
  brandInitials = computed(() => (this.wsCtx.context()?.workspaceName || 'AI').slice(0, 2));
  userName = computed(() => 'Usuário'); // TODO: vem do auth
  userInitials = computed(() => 'US');
  workspaceName = computed(() => this.wsCtx.context()?.workspaceName || 'Workspace');

  openSearch() { /* TODO: modal de busca global */ }
  toggleUserMenu() { /* TODO: dropdown */ }
}