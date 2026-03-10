import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  clearanceLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  workspaceId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'btv_access_token';
  private readonly REFRESH_TOKEN_KEY = 'btv_refresh_token';
  private readonly USER_KEY = 'btv_user';

  private _user = signal<AuthUser | null>(this.loadUserFromStorage());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>('/api/auth/login', { email, password })
      .pipe(tap((tokens) => this.storeTokens(tokens)));
  }

  loginWithSSO(provider: 'google' | 'microsoft' | 'saml'): void {
    window.location.href = `/api/auth/sso/${provider}`;
  }

  refreshToken(): Observable<string> {
    const refresh = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    return this.http
      .post<AuthTokens>('/api/auth/refresh', { refreshToken: refresh })
      .pipe(
        tap((tokens) => this.storeTokens(tokens)),
        // retorna apenas o novo access token
        tap((tokens) => tokens.accessToken)
      ) as unknown as Observable<string>;
  }

  logout(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._user.set(null);
    window.location.href = '/login';
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getWorkspaceId(): string | null {
    return this._user()?.workspaceId ?? null;
  }

  getUserRoles(): string[] {
    return this._user()?.roles ?? [];
  }

  getUserClearanceLevel(): 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' {
    return this._user()?.clearanceLevel ?? 'INTERNAL';
  }

  setUser(user: AuthUser): void {
    this._user.set(user);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  private loadUserFromStorage(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
