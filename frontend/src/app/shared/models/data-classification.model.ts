export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  autoAnonymize: boolean;
  sensitiveKeywords: string[];
  modelConfig: () => ModelConfig;
}

export interface ModelConfig {
  version: () => string;
  temperature: number;
  maxTokens: number;
  topK: number;
}

export interface FilteredMessage {
  content: string;
  originalHash: string;
  classification: Classification;
  piiDetected: boolean;
  piiTypes: string[];
  workspaceId: string;
  userId: string;
  timestamp: string;
  eligibleForTraining: boolean;
}

export interface PIIDetection {
  type: string;
  position: number;
  length: number;
}

export interface Classification {
  level: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  reason: string;
  canTrain: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  classification?: Classification;
  sources?: RAGSource[];
  timestamp: string;
}

export interface RAGSource {
  documentId: string;
  documentName: string;
  chunkText: string;
  similarity: number;
}

export interface FeedbackPayload {
  interactionId: string;
  rating: 'positive' | 'negative';
  correction: string | null;
  categories: string[];
  userId: string;
}
