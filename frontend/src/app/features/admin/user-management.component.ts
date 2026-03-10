import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  clearanceLevel: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string | null;
  createdAt: string;
}

export interface InvitePayload {
  email: string;
  roles: string[];
  clearanceLevel: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="user-management">
      <div class="um-header">
        <h2>&#128101; Gerenciamento de Usuários</h2>
        <button class="btn-invite" (click)="showInvite = !showInvite">
          &#43; Convidar usuário
        </button>
      </div>

      <!-- Formulário de convite -->
      @if (showInvite) {
        <div class="invite-form">
          <h4>&#9993;&#65039; Convidar novo usuário</h4>
          <label>Email
            <input [(ngModel)]="invite.email" type="email" placeholder="usuario@empresa.com" />
          </label>
          <label>Roles
            <div class="roles-checkboxes">
              @for (role of availableRoles; track role.value) {
                <label class="checkbox-label">
                  <input type="checkbox"
                    [checked]="invite.roles.includes(role.value)"
                    (change)="toggleRole(role.value, $event)" />
                  {{ role.label }}
                </label>
              }
            </div>
          </label>
          <label>Nível de acesso
            <select [(ngModel)]="invite.clearanceLevel">
              <option value="INTERNAL">Interno</option>
              <option value="CONFIDENTIAL">Confidencial</option>
              <option value="RESTRICTED">Restrito</option>
            </select>
          </label>
          <div class="invite-actions">
            <button class="btn-send" (click)="sendInvite()" [disabled]="!invite.email">
              &#128140; Enviar convite
            </button>
            <button class="btn-cancel" (click)="showInvite = false">Cancelar</button>
          </div>
          @if (inviteSent()) {
            <p class="success-msg">&#9989; Convite enviado para {{ invite.email }}!</p>
          }
        </div>
      }

      <!-- Lista de usuários -->
      @if (loading()) {
        <div class="loading">Carregando usuários...</div>
      } @else {
        <table class="users-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Roles</th>
              <th>Acesso</th>
              <th>Status</th>
              <th>Último login</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users(); track user.id) {
              <tr [class.inactive]="user.status === 'inactive'">
                <td>
                  <div class="user-info">
                    <strong>{{ user.name }}</strong>
                    <span class="user-email">{{ user.email }}</span>
                  </div>
                </td>
                <td>
                  <div class="role-badges">
                    @for (role of user.roles; track role) {
                      <span class="role-badge" [class]="role">{{ role }}</span>
                    }
                  </div>
                </td>
                <td>
                  <span class="clearance-badge" [class]="user.clearanceLevel.toLowerCase()">
                    {{ user.clearanceLevel }}
                  </span>
                </td>
                <td>
                  <span class="status-dot" [class]="user.status"></span>
                  {{ user.status }}
                </td>
                <td>{{ user.lastLogin ? (user.lastLogin | date:'dd/MM/yy HH:mm') : 'Nunca' }}</td>
                <td class="actions">
                  <button (click)="toggleStatus(user)" [title]="user.status === 'active' ? 'Desativar' : 'Ativar'">
                    {{ user.status === 'active' ? '&#128274;' : '&#128275;' }}
                  </button>
                  <button (click)="removeUser(user)" title="Remover" class="danger">&#128465;&#65039;</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `
})
export class UserManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private workspaceCtx = inject(WorkspaceContextService);

  loading = signal(true);
  users = signal<WorkspaceUser[]>([]);
  inviteSent = signal(false);
  showInvite = false;

  invite: InvitePayload = { email: '', roles: ['member'], clearanceLevel: 'INTERNAL' };

  availableRoles = [
    { value: 'admin', label: '&#128081; Admin' },
    { value: 'curator', label: '&#127919; Curador' },
    { value: 'member', label: '&#128100; Membro' },
    { value: 'viewer', label: '&#128065;&#65039; Visualizador' },
  ];

  ngOnInit(): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.http.get<WorkspaceUser[]>(`/api/workspaces/${wsId}/users`)
      .subscribe({
        next: (u) => { this.users.set(u); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  toggleRole(role: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.invite.roles = [...this.invite.roles, role];
    } else {
      this.invite.roles = this.invite.roles.filter((r) => r !== role);
    }
  }

  sendInvite(): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.http.post(`/api/workspaces/${wsId}/users/invite`, this.invite)
      .subscribe(() => {
        this.inviteSent.set(true);
        this.invite = { email: '', roles: ['member'], clearanceLevel: 'INTERNAL' };
        setTimeout(() => { this.inviteSent.set(false); this.showInvite = false; }, 3000);
      });
  }

  toggleStatus(user: WorkspaceUser): void {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    this.http.patch(`/api/workspaces/${this.workspaceCtx.workspaceId()}/users/${user.id}`, { status: newStatus })
      .subscribe(() => {
        this.users.update((users) =>
          users.map((u) => u.id === user.id ? { ...u, status: newStatus } : u)
        );
      });
  }

  removeUser(user: WorkspaceUser): void {
    if (!confirm(`Remover "${user.name}" do workspace?`)) return;
    this.http.delete(`/api/workspaces/${this.workspaceCtx.workspaceId()}/users/${user.id}`)
      .subscribe(() => this.users.update((u) => u.filter((x) => x.id !== user.id)));
  }
}
