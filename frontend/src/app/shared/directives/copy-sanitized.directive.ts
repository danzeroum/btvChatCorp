import { Directive, HostListener, Input, inject } from '@angular/core';
import { AnonymizerService } from '../../core/services/anonymizer.service';

/**
 * Diretiva que intercepta Ctrl+C / Cmd+C e copia o texto
 * com PII já redactado, impedindo vazamento de dados sensíveis
 * ao copiar respostas do modelo.
 *
 * Uso: <div copySanitized [sanitizeOnCopy]="true">{{ content }}</div>
 */
@Directive({
  selector: '[copySanitized]',
  standalone: true,
})
export class CopySanitizedDirective {
  @Input() sanitizeOnCopy = true;

  private anonymizer = inject(AnonymizerService);

  @HostListener('copy', ['$event'])
  onCopy(event: ClipboardEvent): void {
    if (!this.sanitizeOnCopy) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString();
    if (!selectedText) return;

    // Verifica se há PII no texto selecionado
    const detections = this.anonymizer.detectOnly(selectedText);
    if (detections.length === 0) return; // Sem PII, cópia normal

    // Intercepta e substitui pelo texto sanitizado
    event.preventDefault();
    const { anonymizedText } = this.anonymizer.anonymize(selectedText);

    event.clipboardData?.setData('text/plain', anonymizedText);

    // Feedback visual (opcional: poderia emitir um evento)
    console.info(
      `[CopySanitized] ${detections.length} tipo(s) de PII redactado(s) na cópia:`,
      detections.map((d) => d.type).join(', ')
    );
  }
}
