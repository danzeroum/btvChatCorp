import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'curator' | 'user';
  workspaceId: string;
  workspaceName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private refreshTimer: any;

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  get accessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  get workspaceId(): string | null {
    return this.currentUser?.workspaceId ?? localStorage.getItem('workspace_id');
  }

  login(email: string, password: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>('/api/auth/login', { email, password }).pipe(
      tap(tokens => this.handleTokens(tokens))
    );
  }

  loginWithGoogle(idToken: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>('/api/auth/google', { id_token: idToken }).pipe(
      tap(tokens => this.handleTokens(tokens))
    );
  }

  refreshToken(): Observable<AuthTokens> {
    const refresh = localStorage.getItem('refresh_token');
    return this.http.post<AuthTokens>('/api/auth/refresh', { refresh_token: refresh }).pipe(
      tap(tokens => this.handleTokens(tokens))
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('workspace_id');
    this.currentUserSubject.next(null);
    clearTimeout(this.refreshTimer);
    this.router.navigate(['/login']);
  }

  loadProfile(): Observable<AuthUser> {
    return this.http.get<AuthUser>('/api/auth/me').pipe(
      tap(user => this.currentUserSubject.next(user))
    );
  }

  private handleTokens(tokens: AuthTokens): void {
    localStorage.setItem('access_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
    // Agenda refresh 1 minuto antes de expirar
    const refreshIn = (tokens.expiresIn - 60) * 1000;
    this.refreshTimer = setTimeout(() => this.refreshToken().subscribe(), refreshIn);
  }

  hasRole(role: 'admin' | 'curator' | 'user'): boolean {
    const roleHierarchy = { admin: 3, curator: 2, user: 1 };
    const userRole = this.currentUser?.role ?? 'user';
    return roleHierarchy[userRole] >= roleHierarchy[role];
  }
}
