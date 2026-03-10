import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const token = auth.accessToken;
  const workspaceId = auth.workspaceId;

  // Não intercepta chamadas de auth
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  const authReq = addHeaders(req, token, workspaceId);

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Tenta refresh automático
        return auth.refreshToken().pipe(
          switchMap(tokens => {
            const retryReq = addHeaders(req, tokens.accessToken, workspaceId);
            return next(retryReq);
          }),
          catchError(() => {
            auth.logout();
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};

function addHeaders(
  req: HttpRequest<unknown>,
  token: string | null,
  workspaceId: string | null
): HttpRequest<unknown> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (workspaceId) headers['X-Workspace-ID'] = workspaceId;
  return req.clone({ setHeaders: headers });
}
