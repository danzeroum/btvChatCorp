import { HttpInterceptorFn, HttpErrorResponse, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, switchMap, throwError } from 'rxjs';

/**
 * Interceptor funcional (compatível com provideHttpClient + withInterceptors).
 * Injeta Bearer token e X-Workspace-ID em todas as requisições.
 *
 * Em caso de 401, tenta renovar o token uma vez via POST /auth/refresh e refaz a
 * requisição original automaticamente. Requisições concorrentes compartilham o mesmo
 * refresh em andamento (evita múltiplos refresh em paralelo). Se o refresh falhar,
 * limpa a sessão e redireciona para o login.
 *
 * O refresh no interceptor (e não só nos guards) garante que sessões longas
 * — chat, upload — não sejam interrompidas por logout-surpresa ao expirar o token.
 */

// Estado compartilhado entre invocações do interceptor: um único refresh em andamento.
let refreshInFlight$: Observable<string | null> | null = null;

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

const isAuthEndpoint = (url: string): boolean => {
  try {
    const pathname = new URL(url, location.origin).pathname;
    return AUTH_PATHS.some(p => pathname === p || pathname.endsWith(p));
  } catch {
    return AUTH_PATHS.some(p => url.includes(p));
  }
};

export const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const token = localStorage.getItem('jwt_token');

  // Não injeta header nem trata 401 em rotas públicas de auth (evita recursão no refresh).
  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  return next(withAuth(req, token)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403) {
        router.navigate(['/unauthorized']);
        return throwError(() => error);
      }
      if (error.status !== 401) {
        return throwError(() => error);
      }
      return refreshToken(http).pipe(
        switchMap((newToken) => {
          if (!newToken) {
            clearSession();
            router.navigate(['/auth/login']);
            return throwError(() => error);
          }
          // Refaz a requisição original com o token renovado.
          return next(withAuth(req, newToken));
        })
      );
    })
  );
};

/** Clona a request adicionando Authorization e X-Workspace-ID quando há token. */
function withAuth(req: Parameters<HttpInterceptorFn>[0], token: string | null) {
  if (!token) return req;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const workspaceId = getWorkspaceIdFromToken(token);
  if (workspaceId) headers['X-Workspace-ID'] = workspaceId;
  return req.clone({ setHeaders: headers });
}

/** Renova o token enviando o jwt_token atual ao endpoint POST /auth/refresh.
 *  O backend valida o token (mesmo que próximo de expirar) e devolve { token }.
 *  Concorrentes compartilham o mesmo Observable em andamento. */
function refreshToken(http: HttpClient): Observable<string | null> {
  if (refreshInFlight$) return refreshInFlight$;

  const currentToken = localStorage.getItem('jwt_token');
  if (!currentToken) return of(null);

  refreshInFlight$ = http
    .post<{ token: string }>('/api/v1/auth/refresh', { token: currentToken })
    .pipe(
      map((res) => {
        localStorage.setItem('jwt_token', res.token);
        return res.token;
      }),
      catchError(() => of(null)),
      finalize(() => {
        refreshInFlight$ = null;
      })
    );
  return refreshInFlight$;
}

function clearSession(): void {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('btv_user');
}

// Hint NÃO-confiável para o header X-Workspace-ID (a autorização real é no servidor).
function getWorkspaceIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.workspace_id ?? null;
  } catch {
    return null;
  }
}
