import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';

/**
 * GlobalErrorHandler — captura erros JS nao tratados em toda a aplicacao.
 *
 * Registrar no app.config.ts:
 *   { provide: ErrorHandler, useClass: GlobalErrorHandler }
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private router = inject(Router);
  private zone   = inject(NgZone);

  handleError(error: unknown): void {
    // Loga sempre
    console.error('[GlobalErrorHandler]', error);

    const message = this.extractMessage(error);

    // Chunk load failure — recarga forcada (lazy-load falhou apos deploy)
    if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
      this.zone.run(() => window.location.reload());
      return;
    }

    // Erros de JWT expirado que escaparam do interceptor
    if (message.includes('jwt expired') || message.includes('TokenExpiredError')) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      this.zone.run(() => this.router.navigate(['/auth/login'], {
        queryParams: { reason: 'session_expired' },
      }));
      return;
    }

    // Para outros erros: apenas loga — nao interrompe a UX
    // Em producao, aqui entraria integracao com Sentry/Datadog
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error);
  }
}
