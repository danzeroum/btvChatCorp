import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DocumentViewerComponent, DocumentItem } from './document-viewer.component';
import { HttpEventType } from '@angular/common/http';

const MOCK_DOC: DocumentItem = {
  id: 'doc-1',
  filename: 'hash_relatorio.pdf',
  original_filename: 'relatorio.pdf',
  mime_type: 'application/pdf',
  size_bytes: 204800,
  processing_status: 'completed',
  chunk_count: 12,
  created_at: '2026-03-13T10:00:00Z',
};

describe('DocumentViewerComponent', () => {
  let fixture: ComponentFixture<DocumentViewerComponent>;
  let component: DocumentViewerComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentViewerComponent, HttpClientTestingModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentViewerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve carregar lista de documentos no init', fakeAsync(() => {
    fixture.detectChanges(); // dispara ngOnInit
    const req = http.expectOne('/api/v1/documents');
    expect(req.request.method).toBe('GET');
    req.flush([MOCK_DOC]);
    tick();
    expect(component.documents().length).toBe(1);
    expect(component.documents()[0].original_filename).toBe('relatorio.pdf');
    expect(component.loading()).toBeFalse();
  }));

  it('deve filtrar documentos pelo campo search', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/documents').flush([MOCK_DOC]);
    tick();
    component.search.set('relatorio');
    expect(component.filtered().length).toBe(1);
    component.search.set('xxxxxxx');
    expect(component.filtered().length).toBe(0);
  }));

  it('deve adicionar documento à lista após upload com sucesso', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/documents').flush([]);
    tick();

    const file = new File(['conteudo'], 'novo.pdf', { type: 'application/pdf' });
    component.uploadFiles([file]);

    const uploadReq = http.expectOne('/api/v1/documents');
    expect(uploadReq.request.method).toBe('POST');
    expect(uploadReq.request.body instanceof FormData).toBeTrue();

    // Simula evento de resposta HTTP
    uploadReq.event({ type: HttpEventType.Response, clone: () => ({} as any), body: MOCK_DOC } as any);
    tick();

    expect(component.documents().length).toBe(1);
    expect(component.documents()[0].id).toBe('doc-1');
  }));

  it('deve marcar arquivo como erro quando upload falha', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/documents').flush([]);
    tick();

    const file = new File(['x'], 'falha.pdf', { type: 'application/pdf' });
    component.uploadFiles([file]);

    const req = http.expectOne('/api/v1/documents');
    req.flush({ message: 'Arquivo maior que 50MB' }, { status: 400, statusText: 'Bad Request' });
    tick();

    const entry = component.uploading()[0];
    expect(entry.status).toBe('error');
    expect(entry.error).toBeTruthy();
  }));

  it('deve remover documento da lista após delete', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/documents').flush([MOCK_DOC]);
    tick();

    spyOn(window, 'confirm').and.returnValue(true);
    component.deleteDoc(MOCK_DOC);

    const req = http.expectOne(`/api/v1/documents/${MOCK_DOC.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    tick();

    expect(component.documents().length).toBe(0);
  }));

  it('não deve deletar se usuário cancelar confirm', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/documents').flush([MOCK_DOC]);
    tick();

    spyOn(window, 'confirm').and.returnValue(false);
    component.deleteDoc(MOCK_DOC);
    http.expectNone(`/api/v1/documents/${MOCK_DOC.id}`);
  }));

  it('formatSize deve retornar valores corretos', () => {
    expect(component.formatSize(0)).toBe('-');
    expect(component.formatSize(500)).toBe('500 B');
    expect(component.formatSize(2048)).toBe('2.0 KB');
    expect(component.formatSize(1048576)).toBe('1.0 MB');
  });
});
