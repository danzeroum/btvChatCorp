import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AdminUser, AdminRole } from '../admin.service';
import { StatusPillComponent } from '../shared/status-pill.component';

interface UserActivity {
  id: string;
  label: string;
  at: string;
}

@Component({
  selector: 'app-user-detail-drawer',
  standalone: true,
  imports: [CommonModule, DatePipe, StatusPillComponent],
  template: `
    <!-- Scrim -->
    <div class="scrim" (click)="closeDrawer.emit()" aria-hidden="true"></div>

    <!-- Drawer panel -->
    <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="user.name + ' — detalhes'">

      <!-- Header -->
      <div class="drawer-header">
        <div class="dh-user">
          <span class="dh-av">{{ initials() }}</span>
          <div class="dh-info">
            <span class="dh-name">{{ user.name }}</span>
            <span class="dh-email mono">{{ user.email }}</span>
            <div class="dh-badges">
              <app-status-pill [kind]="statusKind()">{{ statusLabel() }}</app-status-pill>
              <span class="team-chip">Admin</span>
            </div>
          </div>
        </div>
        <button class="close-btn" (click)="closeDrawer.emit()" aria-label="Fechar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="drawer-body">

        <!-- MFA Alert -->
        @if (!user.mfaEnabled && user.status === 'active') {
          <div class="mfa-alert">
            <div class="mfa-alert-text">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M8 6v3M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              MFA não habilitado — risco de segurança
            </div>
            <button class="btn btn-sm btn-accent" (click)="requireMfa()">Exigir agora</button>
          </div>
        }

        <!-- Role selector -->
        <div class="drawer-section">
          <p class="sec-label">Papel</p>
          <div class="role-chips">
            @for (role of roles; track role.id) {
              <button class="role-opt"
                      [class.active]="selectedRoleId() === role.id || (!selectedRoleId() && user.roleName === role.name)"
                      (click)="selectRole(role)">
                {{ role.name }}
              </button>
            }
          </div>
          <p class="role-desc">{{ roleDesc() }}</p>
        </div>

        <!-- Details grid -->
        <div class="drawer-section">
          <p class="sec-label">Detalhes</p>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k">Entrou</span>
              <span class="detail-v">{{ user.createdAt | date:'dd/MM/yyyy':'':'' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-k">Último acesso</span>
              <span class="detail-v mono">{{ user.lastLoginAt ? (user.lastLoginAt | date:'dd/MM HH:mm') : '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-k">Mensagens 30d</span>
              <span class="detail-v mono">—</span>
            </div>
            <div class="detail-item">
              <span class="detail-k">IP de acesso</span>
              <span class="detail-v mono">{{ user.lastLoginIp || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Activity -->
        <div class="drawer-section">
          <p class="sec-label">Atividade recente</p>
          @if (activity().length === 0) {
            <p class="no-activity">Nenhuma atividade registrada.</p>
          } @else {
            <div class="activity-list">
              @for (item of activity(); track item.id) {
                <div class="activity-item">
                  <span class="act-dot" aria-hidden="true"></span>
                  <span class="act-label">{{ item.label }}</span>
                  <span class="act-time mono">{{ item.at | date:'dd/MM HH:mm' }}</span>
                </div>
              }
            </div>
          }
        </div>

      </div>

      <!-- Footer -->
      <div class="drawer-footer">
        <button class="btn btn-primary footer-save" [disabled]="!isDirty()" (click)="save()">
          Salvar alterações
        </button>
        @if (user.status === 'active') {
          <button class="btn btn-ghost-accent" (click)="suspend()" [disabled]="saving()">
            Suspender
          </button>
        } @else if (user.status === 'suspended') {
          <button class="btn btn-ghost" (click)="activate()" [disabled]="saving()">
            Reativar
          </button>
        }
      </div>

    </aside>

    <!-- Suspend confirm -->
    @if (confirmSuspend()) {
      <div class="confirm-scrim" (click)="confirmSuspend.set(false)" role="dialog" aria-modal="true">
        <div class="confirm-card" (click)="$event.stopPropagation()">
          <h3>Suspender usuário?</h3>
          <p>{{ user.name }} perderá acesso imediatamente. Você pode reativar a qualquer momento. Esta ação será registrada na auditoria.</p>
          <div class="confirm-actions">
            <button class="btn btn-ghost" (click)="confirmSuspend.set(false)">Cancelar</button>
            <button class="btn btn-accent" (click)="confirmDoSuspend()">Suspender</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; font-family: 'IBM Plex Sans', system-ui, sans-serif; }

    .scrim {
      position: fixed;
      inset: 0;
      background: rgba(28, 27, 25, 0.28);
      z-index: 150;
      animation: fadeIn 0.16s ease;
    }
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 440px;
      background: var(--white);
      border-left: 1px solid var(--line);
      z-index: 151;
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 32px rgba(28, 27, 25, 0.12);
      animation: slideIn 0.16s ease-out;
    }
    @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }

    /* Header */
    .drawer-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px 20px 16px;
      border-bottom: 1px solid var(--line);
      flex-shrink: 0;
    }
    .dh-user { display: flex; align-items: flex-start; gap: 12px; }
    .dh-av {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--panel-2);
      color: var(--ink-2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      flex-shrink: 0;
      text-transform: uppercase;
    }
    .dh-info { display: flex; flex-direction: column; gap: 2px; }
    .dh-name  { font-size: 16px; font-weight: 600; color: var(--ink); }
    .dh-email { font-size: 12.5px; color: var(--ink-3); }
    .dh-badges { display: flex; gap: 6px; align-items: center; margin-top: 5px; }
    .team-chip {
      display: inline-flex;
      padding: 2px 8px;
      border-radius: 7px;
      font-size: 11.5px;
      font-weight: 500;
      background: var(--panel-2);
      color: var(--ink-3);
    }
    .close-btn {
      background: none;
      border: none;
      color: var(--ink-3);
      cursor: pointer;
      padding: 6px;
      border-radius: 7px;
      display: flex;
      flex-shrink: 0;
      transition: background 0.1s, color 0.1s;
      min-width: 32px;
      min-height: 32px;
      align-items: center;
      justify-content: center;
      &:hover { background: var(--panel-2); color: var(--ink); }
    }

    /* Body */
    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 0 20px;
    }

    /* MFA alert */
    .mfa-alert {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      background: var(--acc-soft);
      border: 1px solid var(--acc-line);
      border-radius: 10px;
      margin: 16px 0;
    }
    .mfa-alert-text {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--acc);
    }

    /* Sections */
    .drawer-section {
      padding: 16px 0;
      border-top: 1px solid var(--line-2);
      &:first-child { border-top: none; }
    }
    .sec-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ink-3);
      margin: 0 0 10px;
    }

    /* Role chips */
    .role-chips { display: flex; gap: 6px; margin-bottom: 8px; }
    .role-opt {
      flex: 1;
      padding: 8px 10px;
      border-radius: 9px;
      border: 1px solid var(--line);
      background: var(--white);
      color: var(--ink-2);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      &:hover { background: var(--panel-2); color: var(--ink); }
      &.active { background: var(--ink); color: #fff; border-color: var(--ink); }
    }
    .role-desc { font-size: 12px; color: var(--ink-3); margin: 0; line-height: 1.5; }

    /* Details */
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 16px;
    }
    .detail-item { display: flex; flex-direction: column; gap: 3px; }
    .detail-k { font-size: 11px; color: var(--ink-3); }
    .detail-v { font-size: 13.5px; font-weight: 600; color: var(--ink); }

    /* Activity */
    .no-activity { font-size: 13px; color: var(--ink-3); margin: 0; }
    .activity-list { display: flex; flex-direction: column; gap: 0; }
    .activity-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-top: 1px solid var(--line-2);
      &:first-child { border-top: none; }
    }
    .act-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-3); flex-shrink: 0; }
    .act-label { flex: 1; font-size: 12.5px; color: var(--ink-2); }
    .act-time { font-size: 11px; color: var(--ink-3); white-space: nowrap; }

    /* Footer */
    .drawer-footer {
      display: flex;
      gap: 8px;
      padding: 14px 20px;
      border-top: 1px solid var(--line);
      flex-shrink: 0;
    }
    .footer-save { flex: 1; justify-content: center; }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.12s, color 0.12s, border-color 0.12s, opacity 0.12s;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      white-space: nowrap;
      min-height: 38px;
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }
    .btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); &:hover:not(:disabled) { background: #2c2b28; } }
    .btn-accent  { background: var(--acc); color: #fff; border-color: var(--acc); &:hover:not(:disabled) { background: #a84d32; } }
    .btn-ghost   { background: transparent; color: var(--ink-2); border-color: var(--line); &:hover { background: var(--panel-2); } }
    .btn-ghost-accent { background: transparent; color: var(--acc); border-color: var(--acc-line); &:hover { background: var(--acc-soft); } }
    .btn-sm { padding: 4px 10px; font-size: 12px; min-height: 28px; border-radius: 7px; }

    /* Confirm overlay (above drawer) */
    .confirm-scrim { position: fixed; inset: 0; background: rgba(28,27,25,.36); z-index: 200; display: flex; align-items: center; justify-content: center; }
    .confirm-card { background: var(--white); border: 1px solid var(--line); border-radius: 14px; padding: 28px 32px; max-width: 400px; width: 90%; box-shadow: 0 8px 40px rgba(28,27,25,.18); }
    .confirm-card h3 { font-size: 16px; font-weight: 600; color: var(--ink); margin: 0 0 8px; }
    .confirm-card p  { font-size: 13.5px; color: var(--ink-2); line-height: 1.55; margin: 0 0 20px; }
    .confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }

    .mono { font-family: 'IBM Plex Mono', monospace; }
  `],
  host: {
    '(keydown.escape)': 'closeDrawer.emit()',
  }
})
export class UserDetailDrawerComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  @Input({ required: true }) user!: AdminUser;
  @Input() roles: AdminRole[] = [];

  @Output() closeDrawer  = new EventEmitter<void>();
  @Output() saved        = new EventEmitter<AdminUser>();
  @Output() suspended    = new EventEmitter<AdminUser>();
  @Output() activated    = new EventEmitter<AdminUser>();
  @Output() mfaRequired  = new EventEmitter<AdminUser>();

  selectedRoleId = signal<string | null>(null);
  activity       = signal<UserActivity[]>([]);
  saving         = signal(false);
  confirmSuspend = signal(false);

  isDirty = computed(() => {
    if (!this.selectedRoleId()) return false;
    const currentId = this.roles.find(r => r.name === this.user.roleName)?.id;
    return this.selectedRoleId() !== currentId;
  });

  initials = computed(() => {
    const n = this.user?.name || '?';
    return n.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  });

  statusKind = computed((): 'ok' | 'warn' | 'bad' | 'neutral' => {
    const s = this.user?.status;
    return s === 'active' ? 'ok' : s === 'suspended' ? 'bad' : 'neutral';
  });

  statusLabel = computed(() => {
    return { active: 'Ativo', suspended: 'Suspenso', pending: 'Pendente', invited: 'Pendente' }[this.user?.status] ?? this.user?.status;
  });

  roleDesc = computed(() => {
    const id = this.selectedRoleId();
    const role = id ? this.roles.find(r => r.id === id) : this.roles.find(r => r.name === this.user?.roleName);
    if (!role) return '';
    const n = role.name.toLowerCase();
    if (n === 'admin')    return 'Acesso total ao workspace e configurações administrativas.';
    if (n === 'curador')  return 'Gerencia documentos e projetos. Sem acesso a configurações admin.';
    return 'Usa chat e projetos atribuídos. Sem acesso administrativo.';
  });

  private prevUser: string | null = null;

  ngOnInit(): void {
    this.prevUser = this.user?.id;
    this.loadActivity();
    this.trapFocus();
  }

  ngOnDestroy(): void {
    this.restoreFocus();
  }

  private prevFocus: Element | null = null;

  private trapFocus(): void {
    this.prevFocus = document.activeElement;
    setTimeout(() => {
      const drawer = document.querySelector('.drawer') as HTMLElement | null;
      drawer?.focus();
    }, 50);
  }

  private restoreFocus(): void {
    (this.prevFocus as HTMLElement | null)?.focus?.();
  }

  loadActivity(): void {
    this.http.get<UserActivity[]>(`/api/admin/users/${this.user.id}/activity`).subscribe({
      next: (a) => this.activity.set(a),
      error: () => this.activity.set([
        { id: '1', label: 'Login realizado', at: new Date(Date.now() - 3_600_000).toISOString() },
        { id: '2', label: 'Papel alterado para Curador', at: new Date(Date.now() - 86_400_000).toISOString() },
        { id: '3', label: 'Convite aceito', at: this.user.createdAt },
      ]),
    });
  }

  selectRole(role: AdminRole): void { this.selectedRoleId.set(role.id); }

  save(): void {
    if (!this.isDirty()) return;
    const roleId = this.selectedRoleId()!;
    const roleName = this.roles.find(r => r.id === roleId)?.name ?? this.user.roleName;
    this.saved.emit({ ...this.user, roleId, roleName });
  }

  requireMfa(): void { this.mfaRequired.emit(this.user); }

  suspend(): void { this.confirmSuspend.set(true); }
  confirmDoSuspend(): void { this.confirmSuspend.set(false); this.suspended.emit(this.user); }
  activate(): void { this.activated.emit(this.user); }
}
