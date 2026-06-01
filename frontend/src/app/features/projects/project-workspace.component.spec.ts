import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { ProjectWorkspaceComponent } from './project-workspace.component';

describe('ProjectWorkspaceComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectWorkspaceComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'proj-123' } } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deve criar o componente', () => {
    const fixture = TestBed.createComponent(ProjectWorkspaceComponent);
    expect(fixture.componentInstance).toBeTruthy();
    // Flush project request
    http.expectOne('/api/v1/projects/proj-123').flush({
      id: 'proj-123', name: 'Teste', description: '', icon: '📁', color: '#6366f1',
    });
    http.match(req => req.url.includes('/api/v1/projects/proj-123/')).forEach(r => r.flush([]));
  });

  it('newChat() faz POST /api/v1/chats com project_id', () => {
    const fixture = TestBed.createComponent(ProjectWorkspaceComponent);
    const comp = fixture.componentInstance;
    comp.project.set({ id: 'proj-123', name: 'T', description: '', icon: '📁', color: '#fff' });

    comp.newChat();

    const req = http.expectOne('/api/v1/chats');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.project_id).toBe('proj-123');
    req.flush({ id: 'chat-456' });
  });

  it('loadProjectData() consome arrays puros (nao wrappers)', () => {
    const fixture = TestBed.createComponent(ProjectWorkspaceComponent);
    const comp = fixture.componentInstance;
    comp.project.set({ id: 'proj-123', name: 'T', description: '', icon: '📁', color: '#fff' });

    comp.loadProjectData('proj-123');

    http.expectOne('/api/v1/projects/proj-123/members').flush([
      { user_id: 'u1', name: 'User 1', email: 'u1@test.com', role: 'member' },
    ]);
    http.expectOne('/api/v1/projects/proj-123/chats').flush([]);
    http.expectOne('/api/v1/projects/proj-123/documents').flush([]);
    http.expectOne('/api/v1/projects/proj-123/instructions').flush([]);

    expect(comp.members().length).toBe(1);
    expect(comp.members()[0].user_id).toBe('u1');
  });

  it('saveInstruction() faz POST /api/v1/projects/:id/instructions', () => {
    const fixture = TestBed.createComponent(ProjectWorkspaceComponent);
    const comp = fixture.componentInstance;
    comp.project.set({ id: 'proj-123', name: 'T', description: '', icon: '📁', color: '#fff' });
    comp.instrName = 'Instrucao de Teste';
    comp.instrContent = 'Conteudo da instrucao';
    comp.instrTrigger = 'always';

    comp.saveInstruction();

    const req = http.expectOne('/api/v1/projects/proj-123/instructions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Instrucao de Teste');
    req.flush(null, { status: 201, statusText: 'Created' });
    // reload: 4 sub-requests
    http.expectOne('/api/v1/projects/proj-123/members').flush([]);
    http.expectOne('/api/v1/projects/proj-123/chats').flush([]);
    http.expectOne('/api/v1/projects/proj-123/documents').flush([]);
    http.expectOne('/api/v1/projects/proj-123/instructions').flush([]);
  });
});
