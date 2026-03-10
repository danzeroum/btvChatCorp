import { Pipe, PipeTransform, inject } from '@angular/core';
import { AnonymizerService } from '../../core/services/anonymizer.service';

/**
 * Pipe para remover PII do display.
 * Uso no template: {{ message.content | redactPii }}
 */
@Pipe({
  name: 'redactPii',
  standalone: true,
  pure: true,
})
export class RedactPiiPipe implements PipeTransform {
  private anonymizer = inject(AnonymizerService);

  transform(value: string | null | undefined): string {
    if (!value) return '';
    return this.anonymizer.anonymize(value, false).text;
  }
}
