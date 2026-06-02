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
  `,
  styles: [`
    :host { display:block; font-family: Inter, system-ui, sans-serif; }
    .active-sessions { padding: 28px 32px; background: #f8fafc; min-height: 100vh; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header h1 { font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .page-header p { font-size:13px; color:#64748b; margin:0; }
    .btn-danger { background:#ef4444; color:#fff; border:none; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; }
    .btn-danger:hover { background:#dc2626; }
    .btn-danger:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-danger.btn-sm { padding:5px 12px; font-size:12px; }
    .sessions-list { display:flex; flex-direction:column; gap:12px; }
    .session-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; display:flex; flex-direction:column; gap:12px; }
    .session-card.current { border-color:#6366f1; background:#fafafa; }
    .session-user { display:flex; align-items:center; gap:12px; }
    .avatar-sm { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; background:#e0e7ff; color:#4338ca; font-size:13px; font-weight:600; flex-shrink:0; }
    .session-user strong { display:block; font-size:14px; font-weight:600; color:#0f172a; }
    .session-email { font-size:12px; color:#64748b; }
    .current-badge { margin-left:auto; background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:500; }
    .session-details { display:flex; flex-wrap:wrap; gap:12px; font-size:12px; color:#64748b; }
    .revoke-btn { align-self:flex-end; }
    .empty-state { text-align:center; padding:40px; color:#94a3b8; font-size:14px; }
  `]
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
