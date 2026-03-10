import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe que remove/redacta PII para exibição segura na UI.
 * Uso: {{ message.content | redactPii }}
 * Útil para logs, audit viewers e qualquer lugar que exiba texto de usuário.
 */
@Pipe({
  name: 'redactPii',
  standalone: true,
  pure: true,
})
export class RedactPiiPipe implements PipeTransform {
  private readonly patterns: { type: string; regex: RegExp }[] = [
    { type: 'CPF',   regex: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g },
    { type: 'CNPJ',  regex: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g },
    { type: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g },
    { type: 'PHONE', regex: /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/g },
    { type: 'CARD',  regex: /\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/g },
    { type: 'RG',    regex: /\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Xx]/g },
  ];

  transform(value: string | null | undefined, mode: 'mask' | 'remove' = 'mask'): string {
    if (!value) return '';

    let result = value;
    for (const { type, regex } of this.patterns) {
      regex.lastIndex = 0;
      if (mode === 'mask') {
        result = result.replace(regex, `[${type} REDACTED]`);
      } else {
        result = result.replace(regex, '');
      }
    }
    return result;
  }
}
