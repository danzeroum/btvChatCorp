import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { adminGuard } from './admin.guard';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

const futureExp = Math.floor(Date.now() / 1000) + 3600;
const pastExp   = Math.floor(Date.now() / 1000) - 3600;

describe('adminGuard', () => {
  let router: Router;
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/admin/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    localStorage.clear();
  });

  it('(1) sem token -> redireciona para /auth/login', () => {
    const r = TestBed.runInInjectionContext(() => adminGuard(dummyRoute, dummyState));
    expect(r).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('(2) token expirado -> redireciona para /auth/login e limpa storage', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', role: 'admin', exp: pastExp }));
    localStorage.setItem('refresh_token', 'ref');
    TestBed.runInInjectionContext(() => adminGuard(dummyRoute, dummyState));
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(localStorage.getItem('jwt_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('(3) role user -> redireciona para /unauthorized', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', role: 'user', exp: futureExp }));
    const r = TestBed.runInInjectionContext(() => adminGuard(dummyRoute, dummyState));
    expect(r).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });

  it('(4) role member -> redireciona para /unauthorized', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', role: 'member', exp: futureExp }));
    const r = TestBed.runInInjectionContext(() => adminGuard(dummyRoute, dummyState));
    expect(r).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });

  it('(5) role admin -> permite acesso', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', role: 'admin', exp: futureExp }));
    const r = TestBed.runInInjectionContext(() => adminGuard(dummyRoute, dummyState));
    expect(r).toBeTrue();
  });

  it('(6) role super_admin -> permite acesso', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', role: 'super_admin', exp: futureExp }));
    const r = TestBed.runInInjectionContext(() => adminGuard(dummyRoute, dummyState));
    expect(r).toBeTrue();
  });

  it('(7) roles como array [admin] -> permite acesso', () => {
    localStorage.setItem('jwt_token', makeToken({ sub: 'u1', roles: ['admin'], exp: futureExp }));
    const r = TestBed.runInInjectionContext(() => adminGuard(dummyRoute, dummyState));
    expect(r).toBeTrue();
  });

  it('(8) token malformado -> redireciona para /auth/login', () => {
    localStorage.setItem('jwt_token', 'nao.eh.umjwt');
    const r = TestBed.runInInjectionContext(() => adminGuard(dummyRoute, dummyState));
    expect(r).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
