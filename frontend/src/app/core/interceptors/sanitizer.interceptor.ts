import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Sanitiza TODA request que sai do frontend.
 * Remove caracteres perigosos, injections e normaliza encoding.
 * Atua como segunda camada de defesa (a primeira é o DataFilterService).
 */
@Injectable()
export class SanitizerInterceptor implements HttpInterceptor {

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    if (request.body && typeof request.body === 'object') {
      const sanitizedBody = this.sanitizeObject(request.body as Record<string, unknown>);
      request = request.clone({ body: sanitizedBody });
    }
    return next.handle(request);
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        result[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'string'
            ? this.sanitizeString(item)
            : typeof item === 'object' && item !== null
            ? this.sanitizeObject(item as Record<string, unknown>)
            : item
        );
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private sanitizeString(input: string): string {
    return input
      // Remove null bytes
      .replace(/\x00/g, '')
      // Escapa tags HTML (XSS)
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Remove sequências de SQL injection mais comuns
      .replace(/('\s*(or|and)\s*'1'\s*='1')/gi, '')
      // Remove script tags (extra safety)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      // Normaliza quebras de linha
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }
}
