import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { genId } from '../utils/uuid';

@Injectable()
export class AuditInterceptor implements HttpInterceptor {
  private readonly AUDIT_PATHS = [
    '/api/documents',
    '/api/admin',
    '/api/training',
    '/api/users',
    '/api/workspaces',
    '/api/feedback',
  ];

  private readonly AUDIT_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const shouldAudit =
      this.AUDIT_METHODS.includes(request.method) &&
      this.AUDIT_PATHS.some((path) => request.url.includes(path));

    if (!shouldAudit) {
      return next.handle(request);
    }

    const startTime = Date.now();
    const correlationId = genId();

    request = request.clone({
      setHeaders: { 'X-Correlation-ID': correlationId },
    });

    return next.handle(request).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            this.logAuditEvent({
              correlationId,
              method: request.method,
              url: request.url,
              statusCode: event.status,
              durationMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            });
          }
        },
        error: (error) => {
          this.logAuditEvent({
            correlationId,
            method: request.method,
            url: request.url,
            statusCode: error.status ?? 0,
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            error: error.message,
          });
        },
      })
    );
  }

  private logAuditEvent(event: AuditEvent): void {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
      navigator.sendBeacon('/api/audit/log', blob);
    } else {
      console.debug('[AUDIT]', event);
    }
  }
}

interface AuditEvent {
  correlationId: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  error?: string;
}
