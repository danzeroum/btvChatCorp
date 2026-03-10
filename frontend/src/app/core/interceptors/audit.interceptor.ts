import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { inject } from '@angular/core';

/**
 * Loga ações relevantes para compliance/auditoria.
 * Captura requests que modificam dados (POST, PUT, DELETE, PATCH)
 * e envia um evento de auditoria ao backend.
 */
@Injectable()
export class AuditInterceptor implements HttpInterceptor {
  // URLs que devem ser auditadas
  private readonly AUDIT_PATHS = [
    '/api/documents',
    '/api/admin',
    '/api/training',
    '/api/users',
    '/api/workspaces',
    '/api/feedback',
  ];

  // Métodos que geram eventos de auditoria
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
    const correlationId = crypto.randomUUID();

    // Adiciona correlation ID para rastrear a request
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
    // Em produção, envia para backend via fire-and-forget
    // Usa sendBeacon para não bloquear navegação
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(event)], {
        type: 'application/json',
      });
      navigator.sendBeacon('/api/audit/log', blob);
    } else {
      // Fallback: loga no console em dev
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
