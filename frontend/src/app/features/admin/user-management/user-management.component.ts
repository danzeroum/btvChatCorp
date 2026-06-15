import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { AdminService, AdminUser, AdminRole } from '../admin.service';
import { KpiCardComponent } from '../shared/kpi-card.component';
import { StatusPillComponent } from '../shared/status-pill.component';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { UserDetailDrawerComponent } from './user-detail-drawer.component';

type UserFilter = 'all' | 'Admin' | 'Curador' | 'Membro' | 'pending' | 'no-mfa' | 'suspended';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, KpiCardComponent,
            StatusPillComponent, EmptyStateComponent, UserDetailDrawerComponent],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <a routerLink="/admin/dashboard" class="breadcrumb-back">← Visão geral</a>
          <h1>Usuários & papéis</h1>
          <p class="subtitle">{{ allUsers().length }} membros · provisionamento por SSO</p>
        </div>
        <div class="header-actions">
          <div class="search-wrap" [class.open]="searchOpen">
            @if (searchOpen) {
              <input class="search-input" type="search" [(ngModel)]="search"
                     placeholder="Buscar nome ou e-mail…" autofocus
                     (blur)="onSearchBlur()"
                     aria-label="Buscar usuários"/>
            }
            <button class="btn btn-ghost" (click)="toggleSearch()" [attr.aria-label]="searchOpen ? 'Fechar busca' : 'Buscar'">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
                <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              @if (!searchOpen) { Buscar }
            </button>
          </div>
          <button class="btn btn-primary" (click)="showInvite = true">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            Convidar
          </button>
        </div>
      </div>

      <div class="page-body">
        <!-- KPIs -->
        <div class="kpi-row">
          <app-kpi-card [value]="allUsers().length" label="Total de membros"/>
          <app-kpi-card [value]="adminCount()" label="Administradores"/>
          <app-kpi-card [value]="mfaPct() + '%'" label="Com MFA"
                        [trend]="mfaPct() < 100 ? noMfaCount() + ' sem MFA' : 'Todos configurados'"
                        [trendDir]="mfaPct() < 100 ? 'warn' : 'up'"/>
          <app-kpi-card [value]="pendingCount()" label="Convites pendentes"/>
        </div>

        <!-- Filter chips -->
        <div class="chip-row">
          @for (f of filters; track f.id) {
            <button class="chip"
                    [class.active]="activeFilter() === f.id"
                    [class.warn-chip]="f.warn"
                    (click)="setFilter(f.id)">
              {{ f.label }}
              @if (f.count && f.count > 0) {
                <span class="chip-count">{{ f.count }}</span>
              }
            </button>
          }
        </div>

        <!-- Bulk action bar -->
        @if (checkedIds.size > 0) {
          <div class="bulk-bar">
            <span class="bulk-count">{{ checkedIds.size }} selecionado(s)</span>
            <div class="bulk-actions">
              <button class="btn btn-ghost btn-sm" (click)="bulkChangeRole()">Mudar papel</button>
              <button class="btn btn-ghost btn-sm" (click)="bulkRequireMfa()">Exigir MFA</button>
              <button class="btn btn-ghost-accent btn-sm" (click)="bulkSuspend()">Suspender</button>
            </div>
            <button class="bulk-clear" (click)="checkedIds.clear()" aria-label="Desfazer seleção">✕</button>
          </div>
        }

        <!-- Grid table -->
        <div class="table-wrap">
          <!-- Header row -->
          <div class="dt-header">
            <span class="dt-head-cell check-col">
              <input type="checkbox" [checked]="allPageChecked()"
                     (change)="toggleAllPage()" aria-label="Selecionar todos"/>
            </span>
            <span class="dt-head-cell user-col">Usuário</span>
            <span class="dt-head-cell role-col">Papel</span>
            <span class="dt-head-cell status-col">Status</span>
            <span class="dt-head-cell mfa-col">MFA</span>
            <span class="dt-head-cell date-col">Último acesso</span>
            <span class="dt-head-cell chev-col"></span>
          </div>

          @if (loading()) {
            @for (i of skeleton; track i) {
              <div class="dt-row skeleton-row">
                <span class="dt-cell check-col"><span class="sk-box sk-sm"></span></span>
                <span class="dt-cell user-col">
                  <span class="sk-av"></span>
                  <div class="sk-text"><span class="sk-box sk-lg"></span><span class="sk-box sk-md"></span></div>
                </span>
                <span class="dt-cell role-col"><span class="sk-box sk-md"></span></span>
                <span class="dt-cell status-col"><span class="sk-box sk-sm"></span></span>
                <span class="dt-cell mfa-col"><span class="sk-box sk-sm"></span></span>
                <span class="dt-cell date-col"><span class="sk-box sk-md"></span></span>
                <span class="dt-cell chev-col"></span>
              </div>
            }
          } @else if (filteredUsers().length === 0) {
            <app-empty-state icon="👤"
                             title="Nenhum usuário neste filtro"
                             description="Tente outro filtro ou realize uma busca diferente."/>
          } @else {
            @for (user of filteredUsers(); track user.id) {
              <div class="dt-row" [class.row-selected]="selectedUser()?.id === user.id"
                   (click)="openDrawer(user)" role="button" tabindex="0"
                   (keydown.enter)="openDrawer(user)">
                <!-- Check -->
                <span class="dt-cell check-col" (click)="$event.stopPropagation()">
                  <input type="checkbox" [checked]="checkedIds.has(user.id)"
                         (change)="toggleCheck(user.id)" [attr.aria-label]="'Selecionar ' + user.name"/>
                </span>
                <!-- User -->
                <span class="dt-cell user-col">
                  <span class="av">{{ initials(user.name) }}</span>
                  <div class="user-info">
                    <span class="user-name">{{ user.name }}</span>
                    <span class="user-email mono">{{ user.email }}</span>
                  </div>
                </span>
                <!-- Role -->
                <span class="dt-cell role-col">
                  <span class="role-chip" [class.role-admin]="isAdmin(user.roleName)">{{ user.roleName }}</span>
                </span>
                <!-- Status -->
                <span class="dt-cell status-col">
                  <app-status-pill [kind]="statusKind(user.status)">{{ statusLabel(user.status) }}</app-status-pill>
                </span>
                <!-- MFA -->
                <span class="dt-cell mfa-col">
                  @if (user.mfaEnabled) {
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="MFA ativo">
                      <path d="M3 8l4 4 6-6" stroke="var(--good)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  } @else {
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="MFA inativo">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="var(--acc)" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                  }
                </span>
                <!-- Date -->
                <span class="dt-cell date-col mono">{{ user.lastLoginAt ? (user.lastLoginAt | date:'dd/MM HH:mm') : '—' }}</span>
                <!-- Chevron -->
                <span class="dt-cell chev-col" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke="var(--ink-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </div>
            }
          }
        </div>
      </div>
    </div>

    <!-- Invite modal -->
    @if (showInvite) {
      <div class="modal-scrim" (click)="showInvite = false" role="dialog" aria-modal="true" aria-label="Convidar usuário">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h3>Convidar usuário</h3>
          <div class="form-group">
            <label class="form-label" for="invite-email">E-mail</label>
            <input id="invite-email" class="form-input" type="email" [(ngModel)]="inviteEmail"
                   placeholder="usuario@empresa.com" autocomplete="off"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="invite-role">Papel</label>
            <select id="invite-role" class="form-input" [(ngModel)]="inviteRoleId">
              <option value="" disabled>Selecione…</option>
              @for (r of roles; track r.id) {
                <option [value]="r.id">{{ r.name }}</option>
              }
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" (click)="showInvite = false">Cancelar</button>
            <button class="btn btn-primary" [disabled]="!inviteEmail || !inviteRoleId" (click)="sendInvite()">
              Enviar convite
            </button>
          </div>
        </div>
      </div>
    }

    <!-- User detail drawer -->
    @if (selectedUser()) {
      <app-user-detail-drawer
        [user]="selectedUser()!"
        [roles]="roles"
        (closeDrawer)="closeDrawer()"
        (saved)="onUserSaved($event)"
        (suspended)="onUserSuspended($event)"
        (activated)="onUserActivated($event)"
        (mfaRequired)="onMfaRequired($event)"/>
    }

    <!-- Toast -->
    @if (toast()) {
      <div class="toast" role="status">{{ toast() }}</div>
    }
  `,
  styles: [`
    :host { display: block; font-family: 'IBM Plex Sans', system-ui, sans-serif; }

    .page { background: var(--white); min-height: 100vh; }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 28px 16px;
      border-bottom: 1px solid var(--line);
    }
    .page-header-left { display: flex; flex-direction: column; gap: 3px; }
    .breadcrumb-back { font-size: 12.5px; color: var(--ink-3); text-decoration: none; &:hover { color: var(--acc); } }
    h1 { font-size: 19px; font-weight: 600; color: var(--ink); margin: 0; letter-spacing: -0.01em; }
    .subtitle { font-size: 13px; color: var(--ink-3); margin: 0; }
    .header-actions { display: flex; gap: 8px; align-items: center; }

    .search-wrap { display: flex; align-items: center; gap: 6px; }
    .search-input {
      padding: 6px 10px;
      border: 1px solid var(--acc-line);
      border-radius: 9px;
      font-size: 13px;
      color: var(--ink);
      background: var(--white);
      outline: none;
      width: 220px;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
    }

    .page-body { padding: 20px 28px 40px; max-width: 1080px; margin: 0 auto; }

    /* KPI row */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    /* Filter chips */
    .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 500;
      border: 1px solid var(--line);
      background: var(--white);
      color: var(--ink-2);
      cursor: pointer;
      transition: background 0.1s, color 0.1s, border-color 0.1s;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      white-space: nowrap;
      min-height: 32px;
      &:hover { background: var(--panel-2); color: var(--ink); }
      &.active { background: var(--ink); color: #fff; border-color: var(--ink); }
      &.warn-chip.active { background: var(--acc); border-color: var(--acc); }
    }
    .chip-count { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; }

    /* Bulk bar */
    .bulk-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--acc-soft);
      border: 1px solid var(--acc-line);
      border-radius: 10px;
      margin-bottom: 12px;
    }
    .bulk-count { font-size: 13px; font-weight: 600; color: var(--acc); flex: 1; }
    .bulk-actions { display: flex; gap: 6px; }
    .bulk-clear { background: none; border: none; color: var(--acc); cursor: pointer; font-size: 14px; padding: 4px; }

    /* Table */
    .table-wrap {
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      background: var(--white);
    }

    .dt-header {
      display: grid;
      grid-template-columns: 34px 1.7fr 110px 96px 60px 116px 40px;
      background: var(--panel);
      border-bottom: 1px solid var(--line);
      padding: 0 16px;
    }
    .dt-head-cell {
      padding: 10px 8px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--ink-3);
      display: flex;
      align-items: center;
    }

    .dt-row {
      display: grid;
      grid-template-columns: 34px 1.7fr 110px 96px 60px 116px 40px;
      border-top: 1px solid var(--line-2);
      padding: 0 16px;
      cursor: pointer;
      transition: background 0.1s;
      &:hover { background: var(--panel); }
      &.row-selected { background: var(--acc-soft); }
    }

    .dt-cell {
      display: flex;
      align-items: center;
      padding: 11px 8px;
      font-size: 13px;
      color: var(--ink-2);
      min-height: 48px;
    }

    .check-col { justify-content: center; }
    .chev-col  { justify-content: center; }

    .av {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--panel-2);
      color: var(--ink-2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
      text-transform: uppercase;
      margin-right: 10px;
    }
    .user-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .user-name { font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-email { font-size: 10.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .role-chip {
      display: inline-flex;
      padding: 3px 9px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 500;
      background: var(--panel-2);
      color: var(--ink-2);
    }
    .role-admin { background: var(--acc-soft); color: var(--acc); }

    /* Skeleton */
    .skeleton-row { pointer-events: none; }
    .sk-av { width: 28px; height: 28px; border-radius: 50%; background: var(--line-2); flex-shrink: 0; margin-right: 10px; }
    .sk-text { display: flex; flex-direction: column; gap: 4px; }
    .sk-box { display: block; background: var(--line-2); border-radius: 4px; height: 12px; animation: shimmer 1.4s ease infinite; }
    .sk-sm { width: 40px; }
    .sk-md { width: 80px; }
    .sk-lg { width: 120px; }
    @keyframes shimmer { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.12s, color 0.12s;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      white-space: nowrap;
      min-height: 36px;
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }
    .btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); &:hover:not(:disabled) { background: #2c2b28; } }
    .btn-ghost { background: transparent; color: var(--ink-2); border-color: var(--line); &:hover { background: var(--panel-2); color: var(--ink); } }
    .btn-ghost-accent { background: transparent; color: var(--acc); border-color: var(--acc-line); &:hover { background: var(--acc-soft); } }
    .btn-sm { padding: 4px 10px; font-size: 12px; min-height: 28px; border-radius: 7px; }

    /* Modal */
    .modal-scrim { position: fixed; inset: 0; background: rgba(28,27,25,.28); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal-card { background: var(--white); border: 1px solid var(--line); border-radius: 14px; padding: 28px 32px; max-width: 420px; width: 90%; box-shadow: 0 8px 40px rgba(28,27,25,.14); }
    .modal-card h3 { font-size: 16px; font-weight: 600; color: var(--ink); margin: 0 0 18px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .form-label { font-size: 12px; font-weight: 500; color: var(--ink-2); }
    .form-input {
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 9px;
      font-size: 13px;
      color: var(--ink);
      background: var(--white);
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      outline: none;
      &:focus { border-color: var(--acc); }
    }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ink);
      color: #fff;
      padding: 10px 20px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 500;
      z-index: 300;
      box-shadow: 0 4px 20px rgba(28,27,25,.2);
    }

    .mono { font-family: 'IBM Plex Mono', monospace; }
  `]
})
export class UserManagementComponent implements OnInit {
  private adminService = inject(AdminService);
  private route        = inject(ActivatedRoute);

  allUsers = signal<AdminUser[]>([]);
  roles: AdminRole[] = [];
  loading  = signal(true);
  toast    = signal('');
  search   = '';
  searchOpen = false;
  showInvite = false;
  inviteEmail = '';
  inviteRoleId = '';
  activeFilter = signal<UserFilter>('all');
  selectedUser = signal<AdminUser | null>(null);
  checkedIds   = new Set<string>();

  skeleton = [1, 2, 3, 4, 5, 6];

  filteredUsers = computed(() => {
    let users = this.allUsers();
    const f = this.activeFilter();
    if (f === 'Admin')     users = users.filter(u => u.roleName?.toLowerCase() === 'admin');
    else if (f === 'Curador')   users = users.filter(u => u.roleName?.toLowerCase() === 'curador');
    else if (f === 'Membro')    users = users.filter(u => u.roleName?.toLowerCase() === 'membro');
    else if (f === 'pending')   users = users.filter(u => u.status === 'pending' || u.status === 'invited');
    else if (f === 'no-mfa')    users = users.filter(u => !u.mfaEnabled && u.status === 'active');
    else if (f === 'suspended') users = users.filter(u => u.status === 'suspended');
    const q = this.search.trim().toLowerCase();
    if (q) users = users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    return users;
  });

  adminCount   = computed(() => this.allUsers().filter(u => u.roleName?.toLowerCase() === 'admin').length);
  pendingCount = computed(() => this.allUsers().filter(u => u.status === 'pending' || u.status === 'invited').length);
  noMfaCount   = computed(() => this.allUsers().filter(u => !u.mfaEnabled && u.status === 'active').length);
  suspendedCount = computed(() => this.allUsers().filter(u => u.status === 'suspended').length);

  mfaPct = computed(() => {
    const active = this.allUsers().filter(u => u.status === 'active');
    if (!active.length) return 0;
    return Math.round(active.filter(u => u.mfaEnabled).length / active.length * 100);
  });

  allPageChecked = computed(() => {
    const ids = this.filteredUsers().map(u => u.id);
    return ids.length > 0 && ids.every(id => this.checkedIds.has(id));
  });

  get filters() {
    return [
      { id: 'all' as UserFilter,       label: 'Todos',     count: 0, warn: false },
      { id: 'Admin' as UserFilter,     label: 'Admin',     count: 0, warn: false },
      { id: 'Curador' as UserFilter,   label: 'Curador',   count: 0, warn: false },
      { id: 'Membro' as UserFilter,    label: 'Membro',    count: 0, warn: false },
      { id: 'pending' as UserFilter,   label: 'Pendentes', count: this.pendingCount(), warn: false },
      { id: 'no-mfa' as UserFilter,    label: 'Sem MFA',   count: this.noMfaCount(),  warn: true },
      { id: 'suspended' as UserFilter, label: 'Suspensos', count: this.suspendedCount(), warn: false },
    ];
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const f = params.get('filter') as UserFilter | null;
      if (f) this.activeFilter.set(f);
    });
    this.adminService.listRoles().subscribe(roles => {
      this.roles = roles;
      this.loadUsers();
    });
  }

  loadUsers(): void {
    this.loading.set(true);
    this.adminService.listUsers().subscribe({
      next: (users) => {
        this.allUsers.set(users.map(u => ({
          ...u,
          roleId: this.roles.find(r => r.name === u.roleName)?.id,
        })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setFilter(f: UserFilter): void {
    this.activeFilter.set(f);
    this.checkedIds.clear();
  }

  openDrawer(user: AdminUser): void { this.selectedUser.set({ ...user }); }
  closeDrawer(): void { this.selectedUser.set(null); }

  onUserSaved(user: AdminUser): void {
    if (!user.roleId) return;
    this.adminService.updateUserRole(user.id, user.roleId).subscribe(() => {
      this.loadUsers();
      this.showToast('Alterações salvas.');
    });
  }

  onUserSuspended(user: AdminUser): void {
    this.adminService.suspendUser(user.id).subscribe(() => {
      this.closeDrawer();
      this.loadUsers();
      this.showToast('Usuário suspenso.');
    });
  }

  onUserActivated(user: AdminUser): void {
    this.adminService.activateUser(user.id).subscribe(() => {
      this.closeDrawer();
      this.loadUsers();
      this.showToast('Usuário reativado.');
    });
  }

  onMfaRequired(_user: AdminUser): void {
    this.showToast('E-mail de MFA enviado.');
  }

  toggleSearch(): void {
    this.searchOpen = !this.searchOpen;
    if (!this.searchOpen) this.search = '';
  }

  onSearchBlur(): void {
    if (!this.search) this.searchOpen = false;
  }

  toggleAllPage(): void {
    const ids = this.filteredUsers().map(u => u.id);
    if (this.allPageChecked()) {
      ids.forEach(id => this.checkedIds.delete(id));
    } else {
      ids.forEach(id => this.checkedIds.add(id));
    }
  }

  toggleCheck(id: string): void {
    if (this.checkedIds.has(id)) this.checkedIds.delete(id);
    else this.checkedIds.add(id);
  }

  bulkChangeRole(): void { this.showToast('Função em desenvolvimento.'); }
  bulkRequireMfa(): void { this.showToast('E-mails de MFA enviados.'); this.checkedIds.clear(); }
  bulkSuspend(): void {
    if (!confirm(`Suspender ${this.checkedIds.size} usuário(s)?`)) return;
    this.showToast(`${this.checkedIds.size} usuário(s) suspensos.`);
    this.checkedIds.clear();
    this.loadUsers();
  }

  sendInvite(): void {
    if (!this.inviteEmail || !this.inviteRoleId) return;
    this.adminService.inviteUser(this.inviteEmail, this.inviteRoleId).subscribe(() => {
      this.showInvite = false;
      this.inviteEmail = '';
      this.loadUsers();
      this.showToast('Convite enviado.');
    });
  }

  isAdmin(role: string): boolean { return role?.toLowerCase() === 'admin'; }

  initials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  statusLabel(s: string): string {
    return { active: 'Ativo', suspended: 'Suspenso', pending: 'Pendente', invited: 'Pendente' }[s] ?? s;
  }

  statusKind(s: string): 'ok' | 'warn' | 'bad' | 'neutral' {
    return s === 'active' ? 'ok' : s === 'suspended' ? 'bad' : 'neutral';
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3500);
  }
}
