// ─── API KEYS ─────────────────────────────────────────────────────────────────

export type ApiResource = 'chat' | 'documents' | 'projects' | 'search' | 'training' | 'usage' | 'webhooks' | 'users' | 'admin';
export type ApiAction   = 'read' | 'write' | 'delete';
export type ApiKeyScope = 'all' | 'specific';
export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface ApiKeyPermission {
  resource: ApiResource;
  actions: ApiAction[];
}

export interface ApiKey {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  // A key é mostrada UMA VEZ na criação; depois só o prefix é exibido
  keyPrefix: string;       // ex: 'sk-live-abc1'
  keyHash: string;         // SHA-256 — nunca a key real
  permissions: ApiKeyPermission[];
  allowedIps?: string[];
  allowedOrigins?: string[];
  rateLimit: number;       // RPM
  projectScope: ApiKeyScope;
  allowedProjectIds?: string[];
  expiresAt?: string;
  status: ApiKeyStatus;
  lastUsedAt?: string;
  totalRequests: number;
  totalTokensUsed: number;
  createdAt: string;
  createdBy: string;
  revokedAt?: string;
  revokedBy?: string;
}

export interface ApiKeyCreateRequest {
  name: string;
  description?: string;
  permissions: ApiKeyPermission[];
  allowedIps?: string[];
  allowedOrigins?: string[];
  rateLimit: number;
  projectScope: ApiKeyScope;
  allowedProjectIds?: string[];
  expiresAt?: string;
}

// Retornado apenas uma vez na criação
export interface ApiKeyCreated extends ApiKey {
  plainKey: string; // 'sk-live-xxxx' — guardar agora, não é recuperável depois
}

// ─── WEBHOOKS ─────────────────────────────────────────────────────────────────

export type WebhookEventType =
  // Chat
  | 'chat.created' | 'chat.message.sent' | 'chat.message.received' | 'chat.completed'
  // Documents
  | 'document.uploaded' | 'document.processed' | 'document.deleted' | 'document.processing_failed'
  // Projects
  | 'project.created' | 'project.updated' | 'project.deleted' | 'project.member.added' | 'project.member.removed'
  // Training
  | 'training.feedback.received' | 'training.batch.started' | 'training.batch.completed'
  | 'training.batch.failed' | 'training.model.deployed'
  // Connectors
  | 'connector.synced' | 'connector.error'
  // Security
  | 'security.pii_detected' | 'security.access_denied' | 'user.login' | 'user.created';

export interface WebhookFilters {
  projectIds?: string[];
  userIds?: string[];
  documentTypes?: string[];
  minSeverity?: 'info' | 'warning' | 'critical';
}

export interface WebhookDeliveryConfig {
  timeout: number;     // segundos (default 10)
  maxRetries: number;  // (default 5)
  retryBackoff: 'linear' | 'exponential';
  headers?: Record<string, string>;
}

export type WebhookStatus = 'active' | 'paused' | 'failing';

export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  description?: string;
  secret: string;      // HMAC secret
  events: WebhookEventType[];
  filters?: WebhookFilters;
  deliveryConfig: WebhookDeliveryConfig;
  status: WebhookStatus;
  consecutiveFailures: number;
  deliveries24h?: number;
  successRate?: number;
  avgLatencyMs?: number;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: number;
  createdAt: string;
  updatedAt: string;
}

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  payload: any;
  attemptNumber: number;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  responseBody?: string;
  responseTimeMs?: number;
  errorMessage?: string;
  scheduledAt: string;
  deliveredAt?: string;
  nextRetryAt?: string;
  createdAt: string;
}

export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  'workspace-id': string;
  data: any;
  apiversion: string;
  deliveryattempt: number;
}
