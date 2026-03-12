import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <div class="messages" #scrollRef>
        <div *ngFor="let msg of messages" [class]="'message ' + msg.role">
          <span *ngIf="!msg.loading">{{ msg.content }}</span>
          <span *ngIf="msg.loading" class="loading">&#9679;&#9679;&#9679;</span>
        </div>
      </div>
      <div class="input-area">
        <input
          [(ngModel)]="input"
          (keyup.enter)="send()"
          [disabled]="sending"
          placeholder="Digite sua mensagem..."
        />
        <button (click)="send()" [disabled]="sending">Enviar</button>
      </div>
    </div>
  `,
  styles: [`
    .chat-container { display: flex; flex-direction: column; height: 100vh; padding: 1rem; }
    .messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-bottom: 0.5rem; }
    .message { padding: 0.75rem 1rem; border-radius: 8px; max-width: 80%; }
    .message.user { background: #2563eb; align-self: flex-end; }
    .message.assistant { background: #1e1e1e; align-self: flex-start; }
    .loading { letter-spacing: 4px; opacity: 0.6; animation: blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:.3} 50%{opacity:1} }
    .input-area { display: flex; gap: 0.5rem; padding-top: 1rem; }
    input { flex: 1; padding: 0.75rem; border-radius: 8px; border: 1px solid #333; background: #1e1e1e; color: #fff; }
    input:disabled { opacity: 0.5; }
    button { padding: 0.75rem 1.5rem; border-radius: 8px; background: #2563eb; color: #fff; border: none; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class ChatComponent {
  messages: Message[] = [];
  input = '';
  sending = false;

  constructor(private http: HttpClient) {}

  send() {
    const text = this.input.trim();
    if (!text || this.sending) return;

    this.messages.push({ role: 'user', content: text });
    this.input = '';
    this.sending = true;

    const placeholder: Message = { role: 'assistant', content: '', loading: true };
    this.messages.push(placeholder);

    const history = this.messages
      .filter(m => !m.loading)
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.content }));

    this.http
      .post<{ response: string }>('/api/v1/chat/', { message: text, history })
      .subscribe({
        next: (res) => {
          placeholder.content = res.response;
          placeholder.loading = false;
          this.sending = false;
        },
        error: (err) => {
          placeholder.content = 'Erro ao obter resposta. Tente novamente.';
          placeholder.loading = false;
          this.sending = false;
          console.error('Chat error:', err);
        }
      });
  }
}
