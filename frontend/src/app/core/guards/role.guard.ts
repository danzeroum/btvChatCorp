import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de RBAC. Uso nas rotas:
 * { path: 'admin', canActivate: [roleGuard('admin')] }
 */
export function roleGuard(requiredRole: 'admin' | 'curator' | 'user'): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.currentUser) {
      router.navigate(['/login']);
      return false;
    }

    if (!auth.hasRole(requiredRole)) {
      router.navigate(['/unauthorized']);
      return false;
    }

    return true;
  };
}
