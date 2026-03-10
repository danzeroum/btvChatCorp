import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface InteractionRecord {
  userMessage: any;
  assistantMessage: any;
  context: any;
}

export interface FeedbackPayload {
  interactionId: string;
  rating: 'positive' | 'negative';
  correction: string | null;
  category: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackCollectorService {

  private interactions = new Map<string, InteractionRecord>();
  private baseUrl = '/api/v1';

  constructor(private http: HttpClient) {}

  recordInteraction(record: InteractionRecord): void {
    const id = record.assistantMessage.id;
    this.interactions.set(id, record);
  }

  addFeedback(feedback: FeedbackPayload): void {
    const interaction = this.interactions.get(feedback.interactionId);
    if (!interaction) return;

    // Envia feedback ao backend
    this.http.post(`${this.baseUrl}/chat/feedback`, {
      interaction_id: feedback.interactionId,
      rating: feedback.rating,
      correction: feedback.correction,
      categories: feedback.category.split(',').filter(Boolean),
    }).subscribe({
      error: err => console.error('Falha ao enviar feedback:', err),
    });
  }
}
