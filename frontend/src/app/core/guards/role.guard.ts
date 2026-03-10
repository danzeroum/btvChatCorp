import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de RBAC (Role-Based Access Control) no frontend.
 * Verifica se o usuário possui a role necessária para acessar a rota.
 *
 * Uso nas rotas:
 * {
 *   path: 'admin',
 *   canActivate: [roleGuard('admin')],
 *   component: AdminComponent
 * }
 */
export function roleGuard(requiredRole: UserRole | UserRole[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const userRoles = authService.getUserRoles();
    const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    const hasRole = required.some((role) => userRoles.includes(role));

    if (hasRole) {
      return true;
    }

    // Redireciona para página adequada baseado na role atual
    if (userRoles.includes('viewer')) {
      router.navigate(['/chat']);
    } else if (!authService.isAuthenticated()) {
      router.navigate(['/login'], {
        queryParams: { returnUrl: router.routerState.snapshot.url },
      });
    } else {
      router.navigate(['/forbidden']);
    }

    return false;
  };
}

/**
 * Guard simples: exige autenticação básica.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login'], {
    queryParams: { returnUrl: router.routerState.snapshot.url },
  });
  return false;
};

// Roles disponíveis na plataforma
export type UserRole =
  | 'super_admin'   // Acesso total (plataforma)
  | 'admin'         // Admin do workspace
  | 'curator'       // Pode aprovar dados de treinamento
  | 'member'        // Usuário padrão
  | 'viewer';       // Apenas leitura
