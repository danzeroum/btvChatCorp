import { Injectable } from '@angular/core';
import { WorkspaceContext, FilteredMessage, PIIDetection, Classification } from '../../shared/models/data-classification.model';

@Injectable({ providedIn: 'root' })
export class DataFilterService {

  private readonly piiPatterns: RegExp[] = [
    /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,           // CPF
    /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,   // CNPJ
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g, // Email
    /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/g, // Telefone BR
    /\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/g,           // Cartão de crédito
  ];

  private readonly piiTypeNames = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'CREDIT_CARD'];

  /**
   * Pipeline completo de filtragem (5 estágios).
   * Chamado antes de qualquer mensagem sair do navegador.
   */
  processMessage(raw: string, context: WorkspaceContext): FilteredMessage {
    // ESTÁGIO 1: Sanitização básica (XSS, injection)
    let sanitized = this.sanitizeInput(raw);

    // ESTÁGIO 2: Detecção de PII
    const piiDetections = this.detectPII(sanitized);

    // ESTÁGIO 3: Classificação de sensibilidade
    const classification = this.classifyContent(sanitized, context);

    // ESTÁGIO 4: Anonimização condicional
    if (context.autoAnonymize) {
      sanitized = this.anonymize(sanitized, piiDetections);
    }

    // ESTÁGIO 5: Enriquecimento com metadados
    return {
      content: sanitized,
      originalHash: this.hash(raw),
      classification,
      piiDetected: piiDetections.length > 0,
      piiTypes: piiDetections.map(d => d.type),
      workspaceId: context.workspaceId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      eligibleForTraining: classification.level !== 'RESTRICTED',
    };
  }

  detectPII(text: string): PIIDetection[] {
    const detections: PIIDetection[] = [];
    for (const [index, pattern] of this.piiPatterns.entries()) {
      const matches = [...text.matchAll(new RegExp(pattern.source, 'g'))];
      for (const match of matches) {
        detections.push({
          type: this.piiTypeNames[index],
          position: match.index!,
          length: match[0].length,
        });
      }
    }
    return detections;
  }

  private anonymize(text: string, detections: PIIDetection[]): string {
    let result = text;
    for (const det of [...detections].reverse()) {
      const placeholder = `[${det.type}_REDACTED]`;
      result = result.slice(0, det.position) + placeholder + result.slice(det.position + det.length);
    }
    return result;
  }

  private classifyContent(text: string, ctx: WorkspaceContext): Classification {
    const keywords = ctx.sensitiveKeywords || [];
    const hasKeyword = keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
    return {
      level: hasKeyword ? 'CONFIDENTIAL' : 'INTERNAL',
      reason: hasKeyword ? 'Contains sensitive keywords' : 'Default',
      canTrain: !hasKeyword,
    };
  }

  private sanitizeInput(text: string): string {
    return text
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  private hash(text: string): string {
    // Simples hash para auditoria (sem guardar original)
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }
}
