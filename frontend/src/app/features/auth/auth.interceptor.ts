import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const token  = localStorage.getItem('jwt_token');

  // Injeta Bearer token em todas as requisicoes autenticadas
  const authReq = (token && !req.url.includes('/auth/login') && !req.url.includes('/auth/register'))
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401) {
          // Token expirado ou invalido — limpa sessao e redireciona
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('refresh_token');
          router.navigate(['/auth/login'], {
            queryParams: { reason: 'session_expired' },
          });
        } else if (err.status === 403) {
          // Autenticado mas sem permissao
          router.navigate(['/unauthorized']);
        }
      }
      return throwError(() => err);
    }),
  );
};
