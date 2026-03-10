import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from '../services/auth.service';

const AUDITABLE_PATHS = ['/api/documents', '/api/training', '/api/admin', '/api/workspace'];

/** Loga ações sensíveis para compliance/auditoria */
export const auditInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const isAuditable = AUDITABLE_PATHS.some(p => req.url.includes(p));

  if (!isAuditable || req.method === 'GET') {
    return next(req);
  }

  const startTime = Date.now();

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        const entry = {
          url: req.url,
          method: req.method,
          userId: auth.currentUser?.id,
          workspaceId: auth.workspaceId,
          statusCode: event.status,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
        // Envia para endpoint de auditoria de forma assíncrona (fire-and-forget)
        navigator.sendBeacon('/api/audit/log', JSON.stringify(entry));
      }
    })
  );
};
