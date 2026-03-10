import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'curator' | 'user';
  lastLogin?: string;
  active: boolean;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="user-management">
      <div class="header">
        <h2>Gerenciamento de Usuários</h2>
        <button (click)="showInvite = !showInvite" class="invite-btn">+ Convidar usuário</button>
      </div>

      @if (showInvite) {
        <div class="invite-form">
          <input [(ngModel)]="inviteEmail" placeholder="email@empresa.com.br" type="email">
          <select [(ngModel)]="inviteRole">
            <option value="user">Usuário</option>
            <option value="curator">Curador</option>
            <option value="admin">Admin</option>
          </select>
          <button (click)="sendInvite()">Enviar convite</button>
        </div>
      }

      <table class="users-table">
        <thead>
          <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Último acesso</th><th>Ações</th></tr>
        </thead>
        <tbody>
          @for (user of users; track user.id) {
            <tr [class.inactive]="!user.active">
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>
                <select [(ngModel)]="user.role" (change)="updateRole(user)">
                  <option value="user">Usuário</option>
                  <option value="curator">Curador</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>{{ user.lastLogin ? (user.lastLogin | date:'dd/MM/yy HH:mm') : 'Nunca' }}</td>
              <td>
                <button (click)="toggleActive(user)">
                  {{ user.active ? 'Desativar' : 'Reativar' }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class UserManagementComponent implements OnInit {
  private http = inject(HttpClient);

  users: WorkspaceUser[] = [];
  showInvite = false;
  inviteEmail = '';
  inviteRole: 'admin' | 'curator' | 'user' = 'user';

  ngOnInit(): void {
    this.http.get<WorkspaceUser[]>('/api/admin/users').subscribe(u => this.users = u);
  }

  sendInvite(): void {
    this.http.post('/api/admin/users/invite', {
      email: this.inviteEmail, role: this.inviteRole
    }).subscribe(() => {
      this.inviteEmail = '';
      this.showInvite = false;
    });
  }

  updateRole(user: WorkspaceUser): void {
    this.http.put(`/api/admin/users/${user.id}/role`, { role: user.role }).subscribe();
  }

  toggleActive(user: WorkspaceUser): void {
    this.http.put(`/api/admin/users/${user.id}/active`, { active: !user.active })
      .subscribe(() => user.active = !user.active);
  }
}
