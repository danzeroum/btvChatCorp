import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Roles com acesso ao painel /admin */
const ADMIN_ROLES = ['admin', 'super_admin'];

/**
 * Lê o JWT em localStorage, verifica validade e role.
 * - Sem token / expirado  → redireciona para /auth/login
 * - Token válido sem role admin → redireciona para /unauthorized
 * - Token válido com role admin → libera acesso
 */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token  = localStorage.getItem('jwt_token');

  if (!token) {
    router.navigate(['/auth/login']);
    return false;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    // Verifica expiração
    if (Date.now() >= payload.exp * 1000) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      router.navigate(['/auth/login']);
      return false;
    }

    // Verifica role — suporta string simples ou array
    const role: string | string[] = payload.role ?? payload.roles ?? '';
    const hasAccess = Array.isArray(role)
      ? role.some(r => ADMIN_ROLES.includes(r))
      : ADMIN_ROLES.includes(role);

    if (!hasAccess) {
      router.navigate(['/unauthorized']);
      return false;
    }

    return true;
  } catch {
    // Token malformado
    localStorage.removeItem('jwt_token');
    router.navigate(['/auth/login']);
    return false;
  }
};
