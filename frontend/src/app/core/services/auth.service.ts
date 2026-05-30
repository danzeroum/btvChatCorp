import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, of, tap, catchError } from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  workspaceId: string;
}

/** Resposta do endpoint protegido GET /api/v1/auth/me (fonte da verdade no servidor) */
interface MeResponse {
  user_id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly JWT_KEY = 'jwt_token';
  private readonly USER_KEY = 'btv_user';

  private _user = signal<AuthUser | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<{ access_token: string }> {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);
    return this.http
      .post<{ access_token: string }>('/api/v1/auth/login', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      .pipe(tap((res) => {
        localStorage.setItem(this.JWT_KEY, res.access_token);
        // O usuário (roles/workspace) é populado pelo servidor via verifySession().
      }));
  }

  /**
   * Verifica a sessão no servidor e popula o usuário a partir de dados frescos.
   * Esta é a ÚNICA fonte autoritativa de roles/workspace — nunca confiar no
   * payload do JWT decodificado no cliente (assinatura não é verificada no browser).
   */
  verifySession(): Observable<AuthUser | null> {
    if (!this.getAccessToken()) {
      this._user.set(null);
      return of(null);
    }
    return this.http.get<MeResponse>('/api/v1/auth/me').pipe(
      map((me) => this.toAuthUser(me)),
      tap((user) => this._user.set(user)),
      catchError(() => {
        this.clearSession();
        return of(null);
      })
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.JWT_KEY);
  }

  getWorkspaceId(): string | null {
    return this._user()?.workspaceId ?? null;
  }

  getUserRoles(): string[] {
    return this._user()?.roles ?? [];
  }

  private toAuthUser(me: MeResponse): AuthUser {
    return {
      id: me.user_id,
      email: me.email,
      name: me.name || me.email,
      roles: me.role ? [me.role] : ['user'],
      workspaceId: me.workspace_id,
    };
  }

  private clearSession(): void {
    localStorage.removeItem(this.JWT_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._user.set(null);
  }
}
