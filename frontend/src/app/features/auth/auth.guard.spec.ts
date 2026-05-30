import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService, AuthUser } from '../../core/services/auth.service';

const USER: AuthUser = {
  id: 'u1',
  email: 'a@b.com',
  name: 'A',
  roles: ['user'],
  workspaceId: 'w1',
};

class MockAuthService {
  session: AuthUser | null = null;
  verifySession(): Observable<AuthUser | null> {
    return of(this.session);
  }
}

describe('authGuard', () => {
  let router: Router;
  let auth: MockAuthService;
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/chat' } as RouterStateSnapshot;

  beforeEach(() => {
    auth = new MockAuthService();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    router = TestBed.inject(Router);
  });

  function run(): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(
      () => authGuard(dummyRoute, dummyState) as Observable<boolean | UrlTree>
    );
  }

  it('redireciona para /auth/login quando o servidor não confirma sessão', async () => {
    auth.session = null;
    const result = await firstValueFrom(run());
    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toBe('/auth/login');
  });

  it('permite acesso quando o servidor confirma a sessão', async () => {
    auth.session = USER;
    const result = await firstValueFrom(run());
    expect(result).toBeTrue();
  });
});
