import {
  Component, Output, EventEmitter, Input, inject, signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataFilterService, FilteredMessage } from '../../core/services/data-filter.service';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import { AnonymizerService } from '../../core/services/anonymizer.service';

export interface PIIWarningEvent {
  types: { type: string; count: number }[];
  text: string;
}

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="input-area">
      <!-- Aviso de PII detectado -->
      @if (piiWarnings().length > 0) {
        <div class="pii-warning">
          <span>⚠️ Dados sensíveis detectados: 
            {{ piiWarnings().map(p => p.type + '(' + p.count + ')').join(', ') }}
          </span>
          <label>
            <input type="checkbox" [(ngModel)]="autoAnonymize">
            Anonimizar automaticamente antes de enviar
          </label>
        </div>
      }

      <div class="input-row">
        <textarea
          [(ngModel)]="inputText"
          (input)="onInput()"
          (keydown.enter)="onEnter($event)"
          [placeholder]="placeholder"
          [disabled]="sending()"
          rows="1"
          class="message-textarea">
        </textarea>

        <button
          (click)="send()"
          [disabled]="!inputText.trim() || sending()"
          class="send-btn">
          @if (sending()) {
            <span class="spinner"></span>
          } @else {
            <span>&#9654;</span>
          }
        </button>
      </div>

      <div class="input-meta">
        <span class="char-count" [class.over]="inputText.length > 4000">
          {{ inputText.length }}/4000
        </span>
        @if (classificationPreview()) {
          <span class="classification-badge" [class]="classificationPreview()!.toLowerCase()">
            {{ classificationPreview() }}
          </span>
        }
      </div>
    </div>
  `
})
export class MessageInputComponent {
  @Input() placeholder = 'Digite sua mensagem...';
  @Output() messageSent = new EventEmitter<FilteredMessage>();
  @Output() piiWarning = new EventEmitter<PIIWarningEvent>();

  private dataFilter = inject(DataFilterService);
  private workspaceCtx = inject(WorkspaceContextService);
  private anonymizer = inject(AnonymizerService);

  inputText = '';
  autoAnonymize = true;
  sending = signal(false);
  piiWarnings = signal<{ type: string; count: number }[]>([]);
  classificationPreview = signal<string | null>(null);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  onInput(): void {
    // Debounce de 400ms para não processar a cada tecla
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.analyzeInput(), 400);
  }

  private analyzeInput(): void {
    if (!this.inputText.trim()) {
      this.piiWarnings.set([]);
      this.classificationPreview.set(null);
      return;
    }
    const detections = this.anonymizer.detectOnly(this.inputText);
    this.piiWarnings.set(detections);
    if (detections.length > 0) {
      this.piiWarning.emit({ types: detections, text: this.inputText });
    }
    const ctx = this.workspaceCtx.context();
    if (ctx) {
      const filtered = this.dataFilter.processMessage(this.inputText, ctx);
      this.classificationPreview.set(filtered.classification.level);
    }
  }

  onEnter(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  async send(): Promise<void> {
    const text = this.inputText.trim();
    if (!text || this.sending()) return;

    const ctx = this.workspaceCtx.context();
    if (!ctx) return;

    this.sending.set(true);
    try {
      let finalText = text;
      if (this.autoAnonymize && this.piiWarnings().length > 0) {
        const result = this.anonymizer.anonymize(text);
        finalText = result.anonymizedText;
      }
      const filtered = this.dataFilter.processMessage(finalText, ctx);
      this.messageSent.emit(filtered);
      this.inputText = '';
      this.piiWarnings.set([]);
      this.classificationPreview.set(null);
    } finally {
      this.sending.set(false);
    }
  }
}
