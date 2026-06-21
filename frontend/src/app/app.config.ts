import { ApplicationConfig, ErrorHandler, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptorFn } from './core/interceptors/auth.interceptor.fn';
import { GlobalErrorHandler } from './core/handlers/global-error-handler';
import { BrandingService, initializeBranding } from './features/white-label/services/branding.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptorFn])
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Carrega o branding white-label (config pública + tema CSS) antes do app subir.
    {
      provide: APP_INITIALIZER,
      useFactory: initializeBranding,
      deps: [BrandingService],
      multi: true,
    },
  ]
};
