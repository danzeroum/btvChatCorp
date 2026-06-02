import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser, AdminRole } from '../admin.service';

type TabFilter = 'all' | 'admin' | 'curator' | 'member' | 'pending' | 'no-mfa' | 'suspended';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="um-page">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Usuários & papéis</h1>
          <p class="page-sub">{{ allUsers().length }} membros · 3 papéis · provisionamento por SSO</p>
        </div>
        <div class="header-right">
          <button class="btn-outline" (click)="openSearch = true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            Buscar
          </button>
          <button class="btn-primary" (click)="showInvite = true">+ Convidar</button>
        </div>
      </div>

      @if (inviteToast()) {
        <div class="invite-toast">{{ inviteToast() }}</div>
      }

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">Total de usuários</span>
          <span class="stat-value">{{ allUsers().length }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Administradores</span>
          <span class="stat-value">{{ adminCount() }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Com MFA</span>
          <div class="stat-mfa">
            <span class="stat-value">{{ mfaPct() }}%</span>
            <span class="stat-target" [class.ok]="mfaPct() >= 100">alvo 100%</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-label">Convites pendentes</span>
          <span class="stat-value">{{ pendingCount() }}</span>
        </div>
      </div>

      <!-- Main content + side panel -->
      <div class="content-area" [class.panel-open]="selectedUser() !== null">
        <div class="table-section">
          <!-- Tabs -->
          <div class="tabs">
            @for (tab of tabs; track tab.id) {
              <button class="tab-btn"
                      [class.active]="activeTab() === tab.id"
                      (click)="setTab(tab.id)">
                {{ tab.label }}
                @if (tab.count && tab.count > 0) {
                  <span class="tab-badge" [class.warn]="tab.warn">{{ tab.count }}</span>
                }
              </button>
            }
          </div>

          <!-- Search bar (inline) -->
          @if (openSearch) {
            <div class="search-row">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="search-icon">
                <circle cx="6" cy="6" r="4.5" stroke="#94a3b8" stroke-width="1.4"/>
                <path d="M9.5 9.5L12.5 12.5" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <input class="search-input" type="text" [(ngModel)]="search"
                     (ngModelChange)="applyFilter()"
                     placeholder="Buscar por nome ou e-mail..."
                     #searchEl autofocus />
              <button class="search-clear" (click)="search=''; applyFilter(); openSearch=false">✕</button>
            </div>
          }

          <!-- Table -->
          <div class="table-wrap">
            <table class="users-table">
              <thead>
                <tr>
                  <th class="col-check">
                    <input type="checkbox" [(ngModel)]="allChecked" (change)="toggleAll()">
                  </th>
                  <th class="col-user">Usuário</th>
                  <th class="col-role">Papel</th>
                  <th class="col-status">Status</th>
                  <th class="col-mfa">MFA</th>
                  <th class="col-date">Último acesso</th>
                  <th class="col-action"></th>
                </tr>
              </thead>
              <tbody>
                @for (user of filteredUsers(); track user.id) {
                  <tr [class.selected]="selectedUser()?.id === user.id"
                      (click)="selectUser(user)">
                    <td class="col-check" (click)="$event.stopPropagation()">
                      <input type="checkbox" [checked]="checkedIds.has(user.id)"
                             (change)="toggleCheck(user.id)">
                    </td>
                    <td class="col-user">
                      <div class="user-cell">
                        <span class="user-av">{{ user.name?.slice(0,2)?.toUpperCase() }}</span>
                        <div class="user-text">
                          <span class="user-name">{{ user.name }}</span>
                          <span class="user-email">{{ user.email }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="col-role">
                      <span class="role-badge" [class]="'role-' + normalizeRole(user.roleName)">
                        {{ user.roleName }}
                      </span>
                    </td>
                    <td class="col-status">
                      <span class="status-badge" [class]="'s-' + user.status">{{ statusLabel(user.status) }}</span>
                    </td>
                    <td class="col-mfa">
                      @if (user.mfaEnabled) {
                        <svg class="mfa-ok" width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8l4 4 6-6" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      } @else {
                        <svg class="mfa-no" width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                      }
                    </td>
                    <td class="col-date">{{ user.lastLoginAt ? (user.lastLoginAt | date:'dd/MM HH:mm') : '—' }}</td>
                    <td class="col-action">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="row-arrow">
                        <path d="M6 3l5 5-5 5" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </td>
                  </tr>
                }
                @empty {
                  <tr>
                    <td colspan="7" class="empty-row">Nenhum usuário encontrado</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- User Detail Panel -->
        @if (selectedUser(); as user) {
          <div class="detail-panel">
            <div class="panel-header">
              <div class="panel-user-info">
                <span class="panel-av">{{ user.name?.slice(0,2)?.toUpperCase() }}</span>
                <div>
                  <p class="panel-name">{{ user.name }}</p>
                  <p class="panel-email">{{ user.email }}</p>
                </div>
              </div>
              <div class="panel-badges">
                <span class="status-badge" [class]="'s-' + user.status">{{ statusLabel(user.status) }}</span>
                <span class="role-badge" [class]="'role-' + normalizeRole(user.roleName)">{{ user.roleName }}</span>
              </div>
              <button class="panel-close" (click)="selectedUser.set(null)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <!-- MFA Warning -->
            @if (!user.mfaEnabled) {
              <div class="mfa-warning">
                <div class="mfa-warn-left">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                    <path d="M8 6v3M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  <span>MFA não habilitado</span>
                </div>
                <button class="btn-enforce" (click)="enforceMfa(user)">Exigir agora</button>
              </div>
            }

            <!-- Role Selector -->
            <div class="panel-section">
              <h4 class="panel-section-title">Papel & Permissões</h4>
              <div class="role-selector">
                @for (role of roles; track role.id) {
                  <button class="role-opt"
                          [class.active]="user.roleId === role.id || user.roleName === role.name"
                          (click)="selectRole(user, role)">
                    {{ role.name }}
                  </button>
                }
              </div>
              <p class="role-desc">{{ getRoleDesc(user) }}</p>
            </div>

            <!-- Details -->
            <div class="panel-section">
              <h4 class="panel-section-title">Detalhes</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">Entrou</span>
                  <span class="detail-value">{{ user.createdAt | date:'dd/MM/yyyy' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Último acesso</span>
                  <span class="detail-value">{{ user.lastLoginAt ? (user.lastLoginAt | date:'dd/MM HH:mm') : '—' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">IP</span>
                  <span class="detail-value">{{ user.lastLoginIp || '—' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">MFA</span>
                  <span class="detail-value" [class.ok-text]="user.mfaEnabled" [class.err-text]="!user.mfaEnabled">
                    {{ user.mfaEnabled ? 'Habilitado' : 'Não habilitado' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="panel-footer">
              <button class="btn-primary full-btn" (click)="saveUserChanges(user)">
                Salvar alterações
              </button>
              @if (user.status === 'active') {
                <button class="btn-danger-outline" (click)="suspend(user)">Suspender</button>
              } @else if (user.status === 'suspended') {
                <button class="btn-success-outline" (click)="activate(user)">Ativar</button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Invite Modal -->
      @if (showInvite) {
        <div class="modal-overlay" (click)="showInvite = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2 class="modal-title">Convidar usuário</h2>
            <div class="form-group">
              <label>E-mail</label>
              <input type="email" [(ngModel)]="inviteEmail" placeholder="usuario@empresa.com">
            </div>
            <div class="form-group">
              <label>Papel</label>
              @if (roles.length === 0) {
                <div class="roles-error">
                  Papéis não carregados — verifique a conexão com o servidor.
                </div>
              } @else {
                <select [(ngModel)]="inviteRoleId">
                  <option value="" disabled>Selecione...</option>
                  @for (r of roles; track r.id) {
                    <option [value]="r.id">{{ r.name }}</option>
                  }
                </select>
              }
            </div>
            <div class="modal-actions">
              <button class="btn-outline" (click)="showInvite = false">Cancelar</button>
              <button class="btn-primary"
                      [disabled]="!inviteEmail || !inviteRoleId"
                      [title]="!inviteRoleId ? 'Selecione um papel para continuar' : ''"
                      (click)="sendInvite()">
                Enviar convite
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit {
  private adminService = inject(AdminService);

  allUsers = signal<AdminUser[]>([]);
  roles: AdminRole[] = [];
  search = '';
  openSearch = false;
  allChecked = false;
  checkedIds = new Set<string>();
  showInvite = false;
  inviteEmail = '';
  inviteRoleId = '';
  inviteToast = signal('');
  activeTab = signal<TabFilter>('all');
  selectedUser = signal<AdminUser | null>(null);

  filteredUsers = computed(() => {
    let users = this.allUsers();
    const tab = this.activeTab();
    if (tab === 'admin') users = users.filter(u => u.roleName?.toLowerCase() === 'admin');
    else if (tab === 'curator') users = users.filter(u => u.roleName?.toLowerCase() === 'curador');
    else if (tab === 'member') users = users.filter(u => u.roleName?.toLowerCase() === 'membro');
    else if (tab === 'pending') users = users.filter(u => u.status === 'pending' || u.status === 'invited');
    else if (tab === 'no-mfa') users = users.filter(u => !u.mfaEnabled && u.status === 'active');
    else if (tab === 'suspended') users = users.filter(u => u.status === 'suspended');
    const q = this.search.trim().toLowerCase();
    if (q) users = users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    return users;
  });

  adminCount = computed(() => this.allUsers().filter(u => u.roleName?.toLowerCase() === 'admin').length);
  pendingCount = computed(() => this.allUsers().filter(u => u.status === 'pending' || u.status === 'invited').length);
  noMfaCount = computed(() => this.allUsers().filter(u => !u.mfaEnabled && u.status === 'active').length);
  suspendedCount = computed(() => this.allUsers().filter(u => u.status === 'suspended').length);
  mfaPct = computed(() => {
    const total = this.allUsers().filter(u => u.status === 'active').length;
    if (!total) return 0;
    const withMfa = this.allUsers().filter(u => u.mfaEnabled && u.status === 'active').length;
    return Math.round((withMfa / total) * 100);
  });

  get tabs() {
    return [
      { id: 'all' as TabFilter, label: 'Todos', count: 0, warn: false },
      { id: 'admin' as TabFilter, label: 'Admin', count: 0, warn: false },
      { id: 'curator' as TabFilter, label: 'Curador', count: 0, warn: false },
      { id: 'member' as TabFilter, label: 'Membro', count: 0, warn: false },
      { id: 'pending' as TabFilter, label: 'Pendentes', count: this.pendingCount(), warn: false },
      { id: 'no-mfa' as TabFilter, label: 'Sem MFA', count: this.noMfaCount(), warn: true },
      { id: 'suspended' as TabFilter, label: 'Suspensos', count: this.suspendedCount(), warn: false },
    ];
  }

  ngOnInit() {
    this.adminService.listRoles().subscribe((roles) => {
      this.roles = roles;
      if (!this.inviteRoleId && roles.length) this.inviteRoleId = roles[0].id;
      this.loadUsers();
    });
  }

  loadUsers() {
    this.adminService.listUsers().subscribe((users) => {
      this.allUsers.set(users.map((u) => ({
        ...u,
        roleId: this.roles.find((r) => r.name === u.roleName)?.id,
      })));
    });
  }

  applyFilter() {}

  setTab(tab: TabFilter) {
    this.activeTab.set(tab);
    this.selectedUser.set(null);
  }

  selectUser(user: AdminUser) { this.selectedUser.set({ ...user }); }

  toggleAll() {
    if (this.allChecked) {
      this.filteredUsers().forEach(u => this.checkedIds.add(u.id));
    } else {
      this.checkedIds.clear();
    }
  }

  toggleCheck(id: string) {
    if (this.checkedIds.has(id)) this.checkedIds.delete(id);
    else this.checkedIds.add(id);
  }

  sendInvite() {
    if (!this.inviteEmail || !this.inviteRoleId) return;
    this.adminService.inviteUser(this.inviteEmail, this.inviteRoleId).subscribe(() => {
      this.showInvite = false;
      this.inviteEmail = '';
      this.loadUsers();
      this.inviteToast.set('Convite criado. E-mail será enviado quando SMTP estiver configurado.');
      setTimeout(() => this.inviteToast.set(''), 5000);
    });
  }

  selectRole(user: AdminUser, role: AdminRole) {
    user.roleId = role.id;
    user.roleName = role.name;
    this.selectedUser.set({ ...user });
  }

  saveUserChanges(user: AdminUser) {
    if (!user.roleId) return;
    this.adminService.updateUserRole(user.id, user.roleId).subscribe(() => {
      this.loadUsers();
    });
  }

  suspend(user: AdminUser) {
    this.adminService.suspendUser(user.id).subscribe(() => {
      user.status = 'suspended';
      this.selectedUser.set({ ...user });
      this.loadUsers();
    });
  }

  activate(user: AdminUser) {
    this.adminService.activateUser(user.id).subscribe(() => {
      user.status = 'active';
      this.selectedUser.set({ ...user });
      this.loadUsers();
    });
  }

  enforceMfa(_user: AdminUser) {
    alert('Enviar e-mail exigindo configuração de MFA (a implementar)');
  }

  normalizeRole(name: string): string {
    if (!name) return 'member';
    const n = name.toLowerCase();
    if (n === 'admin') return 'admin';
    if (n === 'curador' || n === 'curator') return 'curator';
    return 'member';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Ativo',
      suspended: 'Suspenso',
      pending: 'Pendente',
      invited: 'Pendente',
    };
    return map[status] || status;
  }

  getRoleDesc(user: AdminUser): string {
    const n = this.normalizeRole(user.roleName);
    if (n === 'admin') return 'Acesso total ao workspace e configurações.';
    if (n === 'curator') return 'Gerencia documentos e projetos atribuídos.';
    return 'Usa o chat e projetos atribuídos. Sem acesso administrativo.';
  }
}
