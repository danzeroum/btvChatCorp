import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { OnboardingService } from '../services/onboarding.service';

@Component({
  selector: 'app-step-test-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="step-test-chat">
      <div class="step-header">
        <span class="step-emoji">&#129302;</span>
        <h2>Teste sua IA agora!</h2>
        <p>Seus documentos est\xE3o sendo processados. Fa\xE7a uma pergunta e veja a magia.</p>
      </div>

      <!-- Sugest\xF5es -->
      <div class="suggestions">
        <span>Sugest\xF5es:</span>
        @for (s of suggestions; track s) {
          <button class="suggestion-chip" (click)="usesuggestion(s)">{{ s }}</button>
        }
      </div>

      <!-- Mini chat -->
      <div class="test-chat-area">
        @for (msg of messages(); track $index) {
          <div class="test-msg" [class]="msg.role">
            <span class="msg-icon">{{ msg.role === 'user' ? '\uD83D\uDC64' : '\uD83E\uDD16' }}</span>
            <div class="msg-bubble">{{ msg.content }}</div>
          </div>
        }
        @if (loading()) {
          <div class="test-msg assistant">
            <span>&#129302;</span>
            <div class="msg-bubble loading">&#8230;</div>
          </div>
        }
      </div>

      <!-- Input -->
      <div class="test-input-row">
        <input [(ngModel)]="inputText"
          placeholder="Fa\xE7a uma pergunta sobre seus documentos..."
          (keydown.enter)="send()" />
        <button (click)="send()" [disabled]="!inputText.trim() || loading()">
          Enviar &#9654;
        </button>
      </div>
    </div>
  `
})
export class StepTestChatComponent {
  private http = inject(HttpClient);
  private onboardingService = inject(OnboardingService);

  inputText = '';
  loading = signal(false);
  messages = signal<{ role: string; content: string }[]>([]);

  suggestions = [
    'Resuma o primeiro documento enviado',
    'Quais s\xE3o os pontos principais?',
    'Liste os riscos identificados',
    'O que devo saber sobre este documento?',
  ];

  usesuggestion(text: string): void {
    this.inputText = text;
    this.send();
  }

  send(): void {
    const text = this.inputText.trim();
    if (!text || this.loading()) return;

    this.messages.update((m) => [...m, { role: 'user', content: text }]);
    this.inputText = '';
    this.loading.set(true);

    const state = this.onboardingService.getState();
    this.http.post<{ response: string }>('/api/chat/onboarding-test', {
      message: text,
      workspaceId: state.workspaceId,
    }).subscribe({
      next: (res) => {
        this.messages.update((m) => [...m, { role: 'assistant', content: res.response }]);
        this.loading.set(false);
      },
      error: () => {
        this.messages.update((m) => [...m, { role: 'assistant', content: 'Seus documentos ainda est\xE3o sendo processados. Tente novamente em alguns segundos.' }]);
        this.loading.set(false);
      },
    });
  }
}
