import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataFilterService, FilteredMessage } from '../../core/services/data-filter.service';
import { WorkspaceContext } from '../../core/services/workspace-context.service';
import { PIIDetection } from '../../shared/models/data-classification.model';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="input-wrapper">
      <!-- Aviso de PII detectado -->
      @if (piiWarnings.length > 0) {
        <div class="pii-warning">
          ⚠️ Dados sensíveis detectados: {{ piiWarnings.join(', ') }}.
          <span>Serão anonimizados antes do envio.</span>
        </div>
      }

      <div class="input-row">
        <textarea
          [(ngModel)]="inputText"
          (ngModelChange)="onInputChange($event)"
          (keydown.enter)="onEnter($event)"
          [disabled]="disabled"
          placeholder="Digite sua mensagem..."
          rows="1"
          class="message-textarea">
        </textarea>
        <button
          (click)="send()"
          [disabled]="!inputText.trim() || disabled"
          class="send-btn">
          Enviar
        </button>
      </div>
    </div>
  `
})
export class MessageInputComponent {
  @Input() workspace!: WorkspaceContext;
  @Input() disabled = false;
  @Output() messageSent = new EventEmitter<FilteredMessage>();
  @Output() piiWarning = new EventEmitter<string[]>();

  private dataFilter = inject(DataFilterService);

  inputText = '';
  piiWarnings: string[] = [];

  onInputChange(text: string): void {
    // Filtragem em tempo real: detecta PII enquanto o usuário digita
    const detections = this.dataFilter['detectPII'](text) as PIIDetection[];
    this.piiWarnings = [...new Set(detections.map(d => d.type))];
    if (this.piiWarnings.length > 0) {
      this.piiWarning.emit(this.piiWarnings);
    }
  }

  onEnter(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.inputText.trim();
    if (!text) return;

    const filtered = this.dataFilter.processMessage(text, this.workspace);
    this.messageSent.emit(filtered);
    this.inputText = '';
    this.piiWarnings = [];
  }
}
