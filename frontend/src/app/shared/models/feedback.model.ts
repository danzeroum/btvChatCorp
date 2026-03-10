export type FeedbackRating = 'positive' | 'negative';

export type FeedbackCategory =
  | 'factual_error'      // Resposta factualmente incorreta
  | 'tone'               // Tom inadequado
  | 'incomplete'         // Resposta incompleta
  | 'off_topic'          // Fora do contexto
  | 'hallucination'      // Modelo inventou informação
  | 'formatting'         // Problema de formatação
  | 'other';             // Outro

export interface FeedbackEvent {
  messageId: string;
  rating: FeedbackRating;
  correction?: string;          // Resposta corrigida pelo usuário
  category?: FeedbackCategory;
  comment?: string;             // Comentário livre
}

export interface FeedbackRecord {
  id: string;
  interactionId: string;
  userId: string;
  workspaceId: string;
  rating: FeedbackRating;
  correction: string | null;
  category: FeedbackCategory | null;
  comment: string | null;
  submittedAt: string;
  usedForTraining: boolean;
  approvedByAdmin: boolean;
}

export interface InteractionRecord {
  id: string;
  workspaceId: string;
  userId: string;
  userMessage: string;
  assistantResponse: string;
  knowledgeBaseId: string | null;
  classification: string;
  piiDetected: boolean;
  eligibleForTraining: boolean;
  originalHash: string;
  feedback?: FeedbackRecord;
  createdAt: string;
}
