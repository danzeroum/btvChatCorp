import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('jwt_token');

  if (token) {
    // Basic check: token exists and not expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      if (Date.now() < exp) return true;
    } catch { /* invalid token */ }
  }

  // Not authenticated
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('refresh_token');
  router.navigate(['/auth/login']);
  return false;
};