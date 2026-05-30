import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

/** Roles com acesso ao painel /admin */
const ADMIN_ROLES = ['admin', 'super_admin'];

/**
 * Autorização de admin verificada NO SERVIDOR (GET /auth/me).
 * - Sem sessão válida           → /auth/login
 * - Sessão válida sem role admin → /unauthorized
 * - Sessão válida com role admin → libera acesso
 *
 * Importante: a role vem do servidor, nunca do JWT decodificado no cliente —
 * caso contrário um token forjado com role "super_admin" passaria pelo guard.
 */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return auth.verifySession().pipe(
    map((user) => {
      if (!user) return router.createUrlTree(['/auth/login']);
      const hasAccess = user.roles.some((r) => ADMIN_ROLES.includes(r));
      return hasAccess ? true : router.createUrlTree(['/unauthorized']);
    })
  );
};
