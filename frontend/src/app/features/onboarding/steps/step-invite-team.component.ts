import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnboardingService } from '../services/onboarding.service';

@Component({
  selector: 'app-step-invite-team',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="step-invite-team">
      <div class="step-header">
        <span class="step-emoji">&#128101;</span>
        <h2>Convide sua equipe</h2>
        <p>Adicione os primeiros membros do workspace.</p>
      </div>

      <!-- Adicionar emails -->
      <div class="invite-row">
        <input [(ngModel)]="newEmail"
          type="email"
          placeholder="colaborador@empresa.com.br"
          (keydown.enter)="addEmail()" />
        <select [(ngModel)]="newRole">
          <option value="member">Membro</option>
          <option value="admin">Admin</option>
          <option value="curator">Curador</option>
          <option value="viewer">Visualizador</option>
        </select>
        <button (click)="addEmail()" [disabled]="!newEmail.trim()">Adicionar</button>
      </div>

      <!-- Lista de convidados -->
      @if (invites().length > 0) {
        <div class="invites-list">
          @for (inv of invites(); track inv.email) {
            <div class="invite-item">
              <span class="invite-email">{{ inv.email }}</span>
              <span class="invite-role role-badge">{{ inv.role }}</span>
              <button class="btn-remove" (click)="removeInvite(inv.email)">&#10005;</button>
            </div>
          }
        </div>

        <label class="toggle-label">
          <input type="checkbox" [(ngModel)]="sendWelcomeEmail" />
          Enviar email de boas-vindas com tutorial
        </label>
      }

      <!-- Link de convite -->
      <div class="invite-link-section">
        <span>Ou copie o link de convite:</span>
        <div class="link-row">
          <input readonly [value]="inviteLink" />
          <button (click)="copyLink()">{{ copied() ? '&#9989; Copiado!' : '&#128203; Copiar' }}</button>
        </div>
      </div>

      <p class="skip-hint">Pular por agora? Convide mais pessoas depois em Configura\xE7\xF5es.</p>
    </div>
  `
})
export class StepInviteTeamComponent {
  private onboardingService = inject(OnboardingService);

  newEmail = '';
  newRole = 'member';
  sendWelcomeEmail = true;
  copied = signal(false);
  invites = signal<{ email: string; role: string }[]>([]);

  get inviteLink(): string {
    const state = this.onboardingService.getState();
    return `https://${state.workspace?.subdomain ?? 'workspace'}.aiplatform.com/join`;
  }

  addEmail(): void {
    const email = this.newEmail.trim();
    if (!email) return;
    if (!this.invites().some((i) => i.email === email)) {
      this.invites.update((list) => [...list, { email, role: this.newRole }]);
      this.onboardingService.updateState({ team: { invitedEmails: this.invites().map((i) => i.email) } });
    }
    this.newEmail = '';
  }

  removeInvite(email: string): void {
    this.invites.update((list) => list.filter((i) => i.email !== email));
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.inviteLink);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
