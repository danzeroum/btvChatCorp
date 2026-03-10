import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { WorkspaceContextService } from '../services/workspace-context.service';
import { AuthService } from '../services/auth.service';

/**
 * Bloqueia rotas com base no nível de classificação do dado.
 * Uso: { data: { requiredClassification: 'CONFIDENTIAL' }, canActivate: [dataClassificationGuard] }
 */
export const dataClassificationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
) => {
  const ctx = inject(WorkspaceContextService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const required = route.data?.['requiredClassification'] as string | undefined;

  if (!required) return true;

  // RESTRICTED: apenas admins
  if (required === 'RESTRICTED' && !auth.hasRole('admin')) {
    router.navigate(['/unauthorized']);
    return false;
  }

  // CONFIDENTIAL: admins e curadores
  if (required === 'CONFIDENTIAL' && !auth.hasRole('curator')) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};
