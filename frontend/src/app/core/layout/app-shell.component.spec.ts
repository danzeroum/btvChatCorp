import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppShellComponent } from './app-shell.component';
import { WorkspaceContextService } from '../services/workspace-context.service';
import { AuthService, AuthUser } from '../services/auth.service';
import { signal } from '@angular/core';

class MockWorkspaceContextService {
  branding = signal(null);
  context = signal(null);
}

class MockAuthService {
  user = signal<AuthUser | null>(null);
  verifySession() { return { pipe: () => ({}) }; }
}

describe('AppShellComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkspaceContextService, useClass: MockWorkspaceContextService },
        { provide: AuthService, useClass: MockAuthService },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deve criar o componente', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    expect(fixture.componentInstance).toBeTruthy();
    http.expectOne('/api/v1/projects').flush([]);
  });

  it('ngOnInit busca /api/v1/projects e popula projects()', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();

    const req = http.expectOne('/api/v1/projects');
    expect(req.request.method).toBe('GET');
    req.flush([
      { id: 'p1', name: 'Projeto A', icon: '🚀', color: '#6366f1' },
      { id: 'p2', name: 'Projeto B', icon: '📁', color: '#22c55e' },
    ]);

    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.projects().length).toBe(2);
    expect(comp.projects()[0].id).toBe('p1');
    expect(comp.projects()[0].unread).toBe(0);
  });
});
