import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  ip: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  loginAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-active-sessions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="active-sessions">
      <div class="page-header">
        <div>
          <h1>&#128100; Sessões Ativas</h1>
          <p>{{ sessions().length }} sessão(ões) ativa(s) agora.</p>
        </div>
        <button class="btn-danger" (click)="revokeAll()" [disabled]="revoking()">
          &#128683; Encerrar todas (exceto a atual)
        </button>
      </div>

      <div class="sessions-list">
        @for (session of sessions(); track session.id) {
          <div class="session-card" [class.current]="session.isCurrent">
            <div class="session-user">
              <span class="avatar-sm">{{ session.userName.slice(0, 2) }}</span>
              <div>
                <strong>{{ session.userName }}</strong>
                <span class="session-email">{{ session.userEmail }}</span>
              </div>
              @if (session.isCurrent) {
                <span class="current-badge">Sessão atual</span>
              }
            </div>
            <div class="session-details">
              <span>&#127760; {{ session.ip }}</span>
              <span>&#128205; {{ session.city }}, {{ session.country }}</span>
              <span>&#128084; {{ session.browser }} — {{ session.device }}</span>
              <span>&#128197; Login {{ session.loginAt | date:'dd/MM HH:mm' }}</span>
              <span>&#128336; Último acesso {{ session.lastActiveAt | date:'HH:mm:ss' }}</span>
            </div>
            @if (!session.isCurrent) {
              <button class="btn-danger btn-sm" (click)="revokeSession(session)">
                Encerrar
              </button>
            }
          </div>
        }

        @if (sessions().length === 0 && !loading()) {
          <div class="empty-state">Nenhuma sessão ativa encontrada.</div>
        }
      </div>
    </div>
  `
})
export class ActiveSessionsComponent implements OnInit {
  private http = inject(HttpClient);

  loading  = signal(false);
  revoking = signal(false);
  sessions = signal<ActiveSession[]>([]);

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<ActiveSession[]>('/api/admin/security/sessions').subscribe({
      next: (s) => { this.sessions.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  revokeSession(session: ActiveSession): void {
    if (!confirm(`Encerrar sessão de ${session.userName} (${session.ip})?`)) return;
    this.http.delete(`/api/admin/security/sessions/${session.id}`).subscribe(() => {
      this.sessions.update((prev) => prev.filter((s) => s.id !== session.id));
    });
  }

  revokeAll(): void {
    if (!confirm('Encerrar TODAS as sessões ativas (exceto a sua)?')) return;
    this.revoking.set(true);
    this.http.post('/api/admin/security/sessions/revoke-all', {}).subscribe({
      next: () => {
        this.sessions.update((prev) => prev.filter((s) => s.isCurrent));
        this.revoking.set(false);
      },
      error: () => this.revoking.set(false),
    });
  }
}
