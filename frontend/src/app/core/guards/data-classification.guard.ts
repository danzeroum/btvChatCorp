import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que bloqueia acesso a rotas baseado no nível de classificação
 * de dados do usuário e do workspace.
 *
 * Níveis: PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED
 *
 * Uso:
 * {
 *   path: 'restricted-docs',
 *   canActivate: [dataClassificationGuard],
 *   data: { requiredClearance: 'CONFIDENTIAL' }
 * }
 */
export const dataClassificationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredClearance: DataClassificationLevel =
    route.data['requiredClearance'] ?? 'INTERNAL';

  const userClearance = authService.getUserClearanceLevel();

  if (hasRequiredClearance(userClearance, requiredClearance)) {
    return true;
  }

  console.warn(
    `[DataClassificationGuard] Acesso negado. ` +
    `Requerido: ${requiredClearance}, Usuário: ${userClearance}`
  );

  router.navigate(['/access-denied'], {
    queryParams: {
      required: requiredClearance,
      current: userClearance,
    },
  });

  return false;
};

/**
 * Verifica se o clearance do usuário atinge o nível requerido.
 * A hierarquia é: PUBLIC(0) < INTERNAL(1) < CONFIDENTIAL(2) < RESTRICTED(3)
 */
function hasRequiredClearance(
  userLevel: DataClassificationLevel,
  requiredLevel: DataClassificationLevel
): boolean {
  return CLEARANCE_HIERARCHY[userLevel] >= CLEARANCE_HIERARCHY[requiredLevel];
}

const CLEARANCE_HIERARCHY: Record<DataClassificationLevel, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

export type DataClassificationLevel =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';
