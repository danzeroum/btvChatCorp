import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChatContainerComponent } from './chat-container.component';

const MOCK_CHAT = { id: 'chat-1', title: 'Teste de integração', updated_at: new Date().toISOString() };
const MOCK_MSG  = { id: 'msg-1', role: 'assistant', content: 'Olá!', created_at: new Date().toISOString() };

describe('ChatContainerComponent', () => {
  let fixture: ComponentFixture<ChatContainerComponent>;
  let component: ChatContainerComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatContainerComponent, HttpClientTestingModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatContainerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve carregar chats recentes no init', fakeAsync(() => {
    fixture.detectChanges();
    const req = http.expectOne('/api/v1/chats');
    expect(req.request.method).toBe('GET');
    req.flush([MOCK_CHAT]);
    tick();
    expect(component.recentChats().length).toBe(1);
    expect(component.recentChats()[0].id).toBe('chat-1');
  }));

  it('deve criar novo chat no banco antes de enviar a primeira mensagem', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/chats').flush([]);
    tick();

    component.inputText = 'Qual o horário de funcionário?';
    component.send();
    tick();

    // 1º request: POST /api/v1/chats
    const createReq = http.expectOne('/api/v1/chats');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body.title).toBeTruthy();
    createReq.flush(MOCK_CHAT);
    tick();

    // 2º request: POST /api/v1/chats/:id/messages
    const msgReq = http.expectOne(`/api/v1/chats/${MOCK_CHAT.id}/messages`);
    expect(msgReq.request.method).toBe('POST');
    expect(msgReq.request.body.content).toBe('Qual o horário de funcionário?');
    msgReq.flush(MOCK_MSG);
    tick();

    expect(component.activeChatId()).toBe('chat-1');
    expect(component.messages().some(m => m.role === 'assistant')).toBeTrue();
    expect(component.sending()).toBeFalse();
  }));

  it('deve reutilizar chat existente sem criar novo', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/chats').flush([MOCK_CHAT]);
    tick();

    // Seleciona chat existente
    const histReq = http.expectOne('/api/v1/chats'); // selectChat chama GET chats implicitamente? Não — chama GET messages
    // Corrige: selectChat chama /messages
    component.activeChatId.set('chat-1');
    component.inputText = 'Segunda mensagem';
    component.send();
    tick();

    // Não deve criar novo chat
    http.expectNone('/api/v1/chats');
    const msgReq = http.expectOne('/api/v1/chats/chat-1/messages');
    msgReq.flush(MOCK_MSG);
    tick();

    expect(component.messages().some(m => m.content === 'Olá!')).toBeTrue();
  }));

  it('deve carregar histórico ao selecionar chat', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/chats').flush([MOCK_CHAT]);
    tick();

    component.selectChat('chat-1');
    const req = http.expectOne('/api/v1/chats/chat-1/messages');
    expect(req.request.method).toBe('GET');
    req.flush([MOCK_MSG]);
    tick();

    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].content).toBe('Olá!');
  }));

  it('deve enviar feedback positivo corretamente', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/chats').flush([]);
    tick();

    component.activeChatId.set('chat-1');
    component.messages.set([{ ...MOCK_MSG, role: 'assistant' }]);
    component.sendFeedback(component.messages()[0], 1);

    const req = http.expectOne('/api/v1/chats/chat-1/messages/msg-1/feedback');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.feedback).toBe(1);
    req.flush(null, { status: 200, statusText: 'OK' });
    tick();

    expect(component.messages()[0].feedback).toBe(1);
  }));

  it('deve mostrar mensagem de erro quando backend falha', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/chats').flush([]);
    tick();

    component.activeChatId.set('chat-1');
    component.inputText = 'Pergunta';
    component.send();
    tick();

    const req = http.expectOne('/api/v1/chats/chat-1/messages');
    req.flush({}, { status: 500, statusText: 'Internal Server Error' });
    tick();

    const lastMsg = component.messages()[component.messages().length - 1];
    expect(lastMsg.role).toBe('assistant');
    expect(lastMsg.content).toContain('Erro');
    expect(component.sending()).toBeFalse();
  }));

  it('timeAgo deve retornar "agora" para datas recentes', () => {
    const now = new Date().toISOString();
    expect(component.timeAgo(now)).toBe('agora');
  });

  it('não deve enviar se inputText estiver vazio', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('/api/v1/chats').flush([]);
    tick();

    component.inputText = '   ';
    component.send();
    tick();
    http.expectNone('/api/v1/chats');
  }));
});
