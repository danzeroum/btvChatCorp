import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

const futureExp = Math.floor(Date.now() / 1000) + 3600;
const pastExp   = Math.floor(Date.now() / 1000) - 3600;

describe('authGuard', () => {
  let router: Router;
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/chat' } as RouterStateSnapshot;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    localStorage.clear();
  });

  it('deve redirecionar para /auth/login quando nao ha token', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(dummyRoute, dummyState)
    );
    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('deve redirecionar para /auth/login quando token expirado', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', exp: pastExp }));
    const result = TestBed.runInInjectionContext(() =>
      authGuard(dummyRoute, dummyState)
    );
    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('deve permitir acesso com token valido', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', exp: futureExp }));
    const result = TestBed.runInInjectionContext(() =>
      authGuard(dummyRoute, dummyState)
    );
    expect(result).toBeTrue();
  });

  it('deve limpar localStorage quando token expirado', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', exp: pastExp }));
    localStorage.setItem('refresh_token', 'somerefresh');
    TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));
    expect(localStorage.getItem('jwt_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });
});
