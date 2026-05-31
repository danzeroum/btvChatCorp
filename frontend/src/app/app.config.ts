import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptorFn } from './core/interceptors/auth.interceptor.fn';
import { GlobalErrorHandler } from './core/handlers/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptorFn])
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ]
};
