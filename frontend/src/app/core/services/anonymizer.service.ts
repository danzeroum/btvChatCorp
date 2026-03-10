import { Injectable } from '@angular/core';

export interface AnonymizationResult {
  anonymizedText: string;
  replacements: Replacement[];
  reversalMap: Map<string, string>; // token → valor original
}

export interface Replacement {
  token: string;       // ex: [CPF_1]
  original: string;    // valor real (guardado apenas em memória)
  type: string;        // 'CPF', 'EMAIL', etc.
  position: number;
}

/**
 * Anonimização client-side de dados pessoais (PII).
 * O valor real NUNCA sai do navegador — apenas tokens são enviados ao backend.
 * O mapa de reversal fica em memória durante a sessão para exibir ao usuário local.
 */
@Injectable({ providedIn: 'root' })
export class AnonymizerService {
  private readonly patterns: { type: string; regex: RegExp }[] = [
    { type: 'CPF',     regex: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g },
    { type: 'CNPJ',    regex: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g },
    { type: 'EMAIL',   regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g },
    { type: 'PHONE',   regex: /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/g },
    { type: 'CARD',    regex: /\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/g },
    { type: 'RG',      regex: /\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Xx]/g },
    { type: 'CEP',     regex: /\d{5}-?\d{3}/g },
  ];

  // Contador por tipo para gerar tokens únicos ([CPF_1], [CPF_2]...)
  private counters: Record<string, number> = {};

  anonymize(text: string): AnonymizationResult {
    let result = text;
    const replacements: Replacement[] = [];
    const reversalMap = new Map<string, string>();

    // Coleta todas as detecções com posição
    const detections: { type: string; match: string; index: number }[] = [];

    for (const { type, regex } of this.patterns) {
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        detections.push({ type, match: m[0], index: m.index });
      }
    }

    // Ordena por posição DESC para substituir de trás pra frente
    detections.sort((a, b) => b.index - a.index);

    for (const det of detections) {
      const count = (this.counters[det.type] = (this.counters[det.type] ?? 0) + 1);
      const token = `[${det.type}_${count}]`;

      result =
        result.slice(0, det.index) +
        token +
        result.slice(det.index + det.match.length);

      replacements.push({
        token,
        original: det.match,
        type: det.type,
        position: det.index,
      });

      reversalMap.set(token, det.match);
    }

    return { anonymizedText: result, replacements, reversalMap };
  }

  /** Reverte tokens para valores originais (apenas para exibição local) */
  deanonymize(text: string, reversalMap: Map<string, string>): string {
    let result = text;
    for (const [token, original] of reversalMap.entries()) {
      result = result.replaceAll(token, original);
    }
    return result;
  }

  /** Detecta PII sem anonimizar (para warnings ao usuário) */
  detectOnly(text: string): { type: string; count: number }[] {
    const counts: Record<string, number> = {};
    for (const { type, regex } of this.patterns) {
      regex.lastIndex = 0;
      const matches = text.match(regex);
      if (matches?.length) {
        counts[type] = (counts[type] ?? 0) + matches.length;
      }
    }
    return Object.entries(counts).map(([type, count]) => ({ type, count }));
  }

  resetCounters(): void {
    this.counters = {};
  }
}
