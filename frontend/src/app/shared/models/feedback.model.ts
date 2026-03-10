export type FeedbackRating = 'positive' | 'negative';
export type FeedbackCategory = 'factual_error' | 'incomplete' | 'tone' | 'irrelevant' | 'approved';

export interface FeedbackEvent {
  messageId: string;
  interactionId?: string;
  rating: FeedbackRating;
  correction: string | null;
  category: FeedbackCategory | string;
}

export interface FeedbackSubmission {
  interactionId: string;
  rating: FeedbackRating;
  correction?: string;
  categories: FeedbackCategory[];
  userId: string;
  timestamp: string;
}

export interface TrainingInteractionSummary {
  id: string;
  userMessage: string;
  assistantResponse: string;
  userCorrection?: string;
  rating?: FeedbackRating;
  categories: FeedbackCategory[];
  curatorStatus: 'pending' | 'approved' | 'rejected' | 'used_in_training';
  priority: 'high' | 'normal';
  createdAt: string;
  curatedAt?: string;
}
