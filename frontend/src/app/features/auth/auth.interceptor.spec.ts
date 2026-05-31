import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptorFn } from '../../core/interceptors/auth.interceptor.fn';

describe('authInterceptorFn', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptorFn])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http     = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router   = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  afterEach(() => httpMock.verify());

  it('injeta Authorization header quando token existe', () => {
    localStorage.setItem('jwt_token', 'test.token.here');
    http.get('/api/v1/projects').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/projects');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test.token.here');
    req.flush({});
    localStorage.removeItem('jwt_token');
  });

  it('nao injeta header em /auth/login', () => {
    localStorage.setItem('jwt_token', 'test.token.here');
    http.post('/auth/login', {}).subscribe({ error: () => {} });
    const req = httpMock.expectOne('/auth/login');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
    localStorage.removeItem('jwt_token');
  });

  it('redireciona para /unauthorized em 403', () => {
    http.get('/api/v1/admin').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/admin');
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});
