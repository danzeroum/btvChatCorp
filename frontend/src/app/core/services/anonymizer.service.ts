import { Injectable } from '@angular/core';

export interface AnonymizationResult {
  text: string;
  replacements: { original: string; placeholder: string; type: string }[];
  reversible: boolean;
}

@Injectable({ providedIn: 'root' })
export class AnonymizerService {

  private readonly patterns: { type: string; regex: RegExp }[] = [
    { type: 'CPF',     regex: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g },
    { type: 'CNPJ',    regex: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g },
    { type: 'EMAIL',   regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g },
    { type: 'PHONE',   regex: /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/g },
    { type: 'CARD',    regex: /\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/g },
    { type: 'CEP',     regex: /\d{5}-?\d{3}/g },
    { type: 'RG',      regex: /\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Xx]/g },
  ];

  /**
   * Anonimiza texto substituindo PII por placeholders.
   * Modo reversível guarda mapa de substituições em memória (nunca persiste).
   */
  anonymize(text: string, reversible = false): AnonymizationResult {
    let result = text;
    const replacements: AnonymizationResult['replacements'] = [];
    const seen = new Map<string, string>();

    for (const { type, regex } of this.patterns) {
      result = result.replace(regex, (match) => {
        if (seen.has(match)) return seen.get(match)!;
        const placeholder = `[${type}_REDACTED_${replacements.length + 1}]`;
        replacements.push({ original: reversible ? match : '***', placeholder, type });
        seen.set(match, placeholder);
        return placeholder;
      });
    }

    return { text: result, replacements, reversible };
  }

  /** Reverte anonimização (apenas se reversible=true e replacements disponíveis) */
  deanonymize(text: string, replacements: AnonymizationResult['replacements']): string {
    let result = text;
    for (const rep of replacements) {
      if (rep.original !== '***') {
        result = result.replace(rep.placeholder, rep.original);
      }
    }
    return result;
  }

  /** Apenas detecta, sem substituir */
  detect(text: string): { type: string; value: string; index: number }[] {
    const findings: { type: string; value: string; index: number }[] = [];
    for (const { type, regex } of this.patterns) {
      for (const match of text.matchAll(regex)) {
        findings.push({ type, value: match[0], index: match.index! });
      }
    }
    return findings.sort((a, b) => a.index - b.index);
  }

  hasPII(text: string): boolean {
    return this.detect(text).length > 0;
  }
}
