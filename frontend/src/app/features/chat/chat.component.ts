import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <div class="messages">
        <div *ngFor="let msg of messages" [class]="'message ' + msg.role">
          <span>{{ msg.content }}</span>
        </div>
      </div>
      <div class="input-area">
        <input [(ngModel)]="input" (keyup.enter)="send()" placeholder="Digite sua mensagem..." />
        <button (click)="send()">Enviar</button>
      </div>
    </div>
  `,
  styles: [`
    .chat-container { display: flex; flex-direction: column; height: 100vh; padding: 1rem; }
    .messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; }
    .message { padding: 0.75rem 1rem; border-radius: 8px; max-width: 80%; }
    .message.user { background: #2563eb; align-self: flex-end; }
    .message.assistant { background: #1e1e1e; align-self: flex-start; }
    .input-area { display: flex; gap: 0.5rem; padding-top: 1rem; }
    input { flex: 1; padding: 0.75rem; border-radius: 8px; border: 1px solid #333; background: #1e1e1e; color: #fff; }
    button { padding: 0.75rem 1.5rem; border-radius: 8px; background: #2563eb; color: #fff; border: none; cursor: pointer; }
  `]
})
export class ChatComponent {
  messages: { role: string; content: string }[] = [];
  input = '';

  send() {
    if (!this.input.trim()) return;
    this.messages.push({ role: 'user', content: this.input });
    this.input = '';
    // TODO: integrar com API de chat
    setTimeout(() => {
      this.messages.push({ role: 'assistant', content: 'Processando sua mensagem...' });
    }, 500);
  }
}
