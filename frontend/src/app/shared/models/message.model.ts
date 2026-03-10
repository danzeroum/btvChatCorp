import { DataClassification } from './data-classification.model';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  score: number;
  sectionTitle?: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  sources?: RAGSource[];
  classification?: DataClassification;
  isStreaming?: boolean;
  feedbackId?: string;       // Referência ao feedback submetido
  interactionId?: string;    // ID do par pergunta/resposta para treino
}

export interface StreamChunk {
  type: 'token' | 'sources' | 'done' | 'error';
  data: string | RAGSource[] | null;
  interactionId?: string;
}

export interface SendMessageRequest {
  content: string;
  workspaceId: string;
  userId: string;
  knowledgeBaseId: string | null;
  classification: DataClassification;
  piiDetected: boolean;
  eligibleForTraining: boolean;
  originalHash: string;
  timestamp: string;
}
