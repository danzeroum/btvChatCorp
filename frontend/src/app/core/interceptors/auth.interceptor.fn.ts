import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Interceptor funcional (compatível com provideHttpClient + withInterceptors).
 * Injeta Bearer token e X-Workspace-ID em todas as requisições.
 * Em caso de 401, redireciona para /auth/login.
 */
export const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('jwt_token');
  const workspaceId = getWorkspaceIdFromToken(token);

  // Não injeta header em rotas públicas de auth
  if (req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
    return next(req);
  }

  let authReq = req;
  if (token) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (workspaceId) headers['X-Workspace-ID'] = workspaceId;
    authReq = req.clone({ setHeaders: headers });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('refresh_token');
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};

function getWorkspaceIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.workspace_id ?? null;
  } catch {
    return null;
  }
}
