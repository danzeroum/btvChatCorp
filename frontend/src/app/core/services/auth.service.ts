import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  workspaceId: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly JWT_KEY = 'jwt_token';
  private readonly USER_KEY = 'btv_user';

  private _user = signal<AuthUser | null>(this.loadUserFromStorage());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor(private http: HttpClient) {}

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
        const user = this.decodeUser(res.access_token);
        if (user) this._user.set(user);
      }));
  }

  logout(): void {
    localStorage.removeItem(this.JWT_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._user.set(null);
    window.location.href = '/auth/login';
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

  private decodeUser(token: string): AuthUser | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.sub,
        email: payload.email ?? '',
        name: payload.name ?? payload.email ?? '',
        roles: payload.roles ?? ['user'],
        workspaceId: payload.workspace_id ?? '',
      };
    } catch {
      return null;
    }
  }

  private loadUserFromStorage(): AuthUser | null {
    const token = localStorage.getItem(this.JWT_KEY);
    if (!token) return null;
    // Verifica expiração
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        localStorage.removeItem(this.JWT_KEY);
        return null;
      }
      return this.decodeUser(token);
    } catch {
      return null;
    }
  }
}
