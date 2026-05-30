import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

/**
 * Libera o acesso apenas quando o servidor confirma a sessão (GET /auth/me).
 * Não confia no JWT decodificado no cliente (assinatura não verificável no browser).
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return auth.verifySession().pipe(
    map((user) => (user ? true : router.createUrlTree(['/auth/login'])))
  );
};
