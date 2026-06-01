import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AuthService, AuthUser } from '../../core/services/auth.service';

function user(roles: string[]): AuthUser {
  return { id: 'u1', email: 'a@b.com', name: 'A', roles, workspaceId: 'w1' };
}

class MockAuthService {
  session: AuthUser | null = null;
  verifySession(): Observable<AuthUser | null> {
    return of(this.session);
  }
}

describe('adminGuard (autorização verificada no servidor)', () => {
  let router: Router;
  let auth: MockAuthService;
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/admin/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    auth = new MockAuthService();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    router = TestBed.inject(Router);
  });

  function run(): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(
      () => adminGuard(dummyRoute, dummyState) as Observable<boolean | UrlTree>
    );
  }

  it('sem sessão -> /auth/login', async () => {
    auth.session = null;
    const r = await firstValueFrom(run());
    expect((r as UrlTree).toString()).toBe('/auth/login');
  });

  it('role user -> /unauthorized', async () => {
    auth.session = user(['user']);
    const r = await firstValueFrom(run());
    expect((r as UrlTree).toString()).toBe('/unauthorized');
  });

  it('role admin -> permite acesso', async () => {
    auth.session = user(['admin']);
    expect(await firstValueFrom(run())).toBeTrue();
  });

  it('role super_admin -> permite acesso', async () => {
    auth.session = user(['super_admin']);
    expect(await firstValueFrom(run())).toBeTrue();
  });

  it('role owner -> permite acesso', async () => {
    auth.session = user(['owner']);
    expect(await firstValueFrom(run())).toBeTrue();
  });
});
