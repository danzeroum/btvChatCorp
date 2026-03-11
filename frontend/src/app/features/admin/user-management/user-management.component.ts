import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser } from '../admin.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="user-management">
      <div class="page-header">
        <div><h1>Usuários</h1><p>Gerencie membros e permissões do workspace</p></div>
        <button class="btn-primary" (click)="showInvite = true">+ Convidar</button>
      </div>

      <!-- Modal de convite -->
      <div class="modal-overlay" *ngIf="showInvite" (click)="showInvite = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Convidar usuário</h2>
          <div class="form-group">
            <label>E-mail</label>
            <input type="email" [(ngModel)]="inviteEmail" placeholder="usuario@empresa.com">
          </div>
          <div class="form-group">
            <label>Role</label>
            <select [(ngModel)]="inviteRole">
              <option value="member">Membro</option>
              <option value="curator">Curador de dados</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="showInvite = false">Cancelar</button>
            <button class="btn-primary" (click)="sendInvite()">Enviar convite</button>
          </div>
        </div>
      </div>

      <!-- Busca -->
      <div class="search-bar">
        <input type="text" [(ngModel)]="search" (input)="onSearch()" placeholder="Buscar por nome ou e-mail...">
      </div>

      <!-- Tabela de usuários -->
      <table class="users-table">
        <thead>
          <tr><th>Usuário</th><th>Role</th><th>Status</th><th>MFA</th><th>Último acesso</th><th>Ações</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let user of users">
            <td>
              <div class="user-info">
                <div class="avatar">{{ user.name[0] }}</div>
                <div>
                  <strong>{{ user.name }}</strong>
                  <div class="email">{{ user.email }}</div>
                </div>
              </div>
            </td>
            <td>
              <select [(ngModel)]="user.role" (change)="updateRole(user)"
                [disabled]="user.status === 'suspended'">
                <option value="member">Membro</option>
                <option value="curator">Curador</option>
                <option value="admin">Admin</option>
              </select>
            </td>
            <td><span class="status-badge" [class]="'s-' + user.status">{{ user.status }}</span></td>
            <td><span class="mfa-badge" [class.enabled]="user.mfaEnabled">{{ user.mfaEnabled ? '✅' : '❌' }}</span></td>
            <td>{{ user.lastLoginAt ? (user.lastLoginAt | date:'dd/MM/yyyy HH:mm') : '—' }}</td>
            <td>
              <button class="action-btn" *ngIf="user.status === 'active'" (click)="suspend(user)">
                Suspender
              </button>
              <button class="action-btn activate" *ngIf="user.status === 'suspended'" (click)="activate(user)">
                Ativar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit {
  private adminService = inject(AdminService);
  users: AdminUser[] = [];
  search = '';
  showInvite = false;
  inviteEmail = '';
  inviteRole = 'member';

  ngOnInit() { this.loadUsers(); }

  loadUsers() {
    this.adminService.listUsers(1, 50, this.search || undefined).subscribe(
      ({ users }) => (this.users = users),
    );
  }

  onSearch() { this.loadUsers(); }

  sendInvite() {
    this.adminService.inviteUser(this.inviteEmail, this.inviteRole).subscribe(() => {
      this.showInvite = false;
      this.inviteEmail = '';
      this.loadUsers();
    });
  }

  updateRole(user: AdminUser) {
    this.adminService.updateUserRole(user.id, user.role).subscribe();
  }

  suspend(user: AdminUser) {
    this.adminService.suspendUser(user.id).subscribe(() => (user.status = 'suspended'));
  }

  activate(user: AdminUser) {
    this.adminService.activateUser(user.id).subscribe(() => (user.status = 'active'));
  }
}
