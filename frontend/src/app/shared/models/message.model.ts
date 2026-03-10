export type MessageRole = 'user' | 'assistant' | 'system';

export interface RAGSource {
  documentId: string;
  documentName: string;
  chunkId: string;
  sectionTitle?: string;
  similarityScore: number;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  sources?: RAGSource[];
  classification?: string;
  piiDetected?: boolean;
  isStreaming?: boolean;
  interactionId?: string; // ID no banco para feedback
}

export interface Conversation {
  id: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
