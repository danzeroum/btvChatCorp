import { Directive, HostListener, Input } from '@angular/core';
import { AnonymizerService } from '../../core/services/anonymizer.service';

/**
 * Diretiva que intercepta Ctrl+C e copia texto sem dados sensíveis.
 * Uso: <div [appCopySanitized]="message.content">...</div>
 */
@Directive({
  selector: '[appCopySanitized]',
  standalone: true,
})
export class CopySanitizedDirective {
  @Input('appCopySanitized') content = '';

  constructor(private anonymizer: AnonymizerService) {}

  @HostListener('copy', ['$event'])
  onCopy(event: ClipboardEvent): void {
    event.preventDefault();
    const clean = this.anonymizer.anonymize(this.content, false).text;
    event.clipboardData?.setData('text/plain', clean);
  }
}
