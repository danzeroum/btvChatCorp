// ─── USUÁRIOS E PERMISSÕES ─────────────────────────────────────────────────

export type PermissionResource =
  | 'workspace' | 'projects' | 'documents' | 'chats' | 'instructions'
  | 'connectors' | 'users' | 'auditlogs' | 'aiconfig' | 'billing'
  | 'trainingdata' | 'apikeys';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'manage' | 'approve';

export interface Permission {
  resource: PermissionResource;
  actions: PermissionAction[];
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Permission[];
  userCount: number;
}

export interface UserStats {
  totalChats: number;
  totalMessages: number;
  totalDocumentsUploaded: number;
  totalFeedbackGiven: number;
  avgSessionDuration: number;
  lastActiveAt: string;
  tokensConsumed: number;
  topProjects: { name: string; messageCount: number }[];
}

export interface WorkspaceUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  customPermissions?: Permission[];
  status: 'active' | 'invited' | 'suspended' | 'deactivated';
  stats: UserStats;
  lastLoginAt?: string;
  lastLoginIp?: string;
  mfaEnabled: boolean;
  loginMethod: 'email' | 'sso_google' | 'sso_microsoft' | 'sso_saml';
  projectIds: string[];
  createdAt: string;
  invitedBy?: string;
}

// ─── AUDITORIA ──────────────────────────────────────────────────────────────

export type AuditAction =
  | 'login' | 'logout' | 'login_failed'
  | 'user_created' | 'user_suspended' | 'user_role_changed'
  | 'document_uploaded' | 'document_deleted' | 'document_exported'
  | 'chat_created' | 'chat_exported' | 'chat_deleted'
  | 'project_created' | 'project_deleted' | 'project_member_added'
  | 'instruction_created' | 'instruction_modified'
  | 'connector_added' | 'connector_synced'
  | 'training_started' | 'training_deployed' | 'training_rolledback'
  | 'model_changed' | 'lora_deployed'
  | 'api_key_created' | 'api_key_revoked'
  | 'settings_changed' | 'policy_changed'
  | 'data_exported' | 'bulk_delete'
  | 'pii_detected' | 'access_denied';

export type AuditCategory =
  | 'authentication' | 'user_management' | 'data_access'
  | 'ai_operations' | 'system_config' | 'security_event';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  // Quem
  userId: string;
  userName: string;
  userIp: string;
  userAgent: string;
  // O quê
  action: AuditAction;
  resource: string;
  resourceId: string;
  resourceName: string;
  // Detalhes
  details: Record<string, any>;
  previousValue?: any;
  newValue?: any;
  // Classificação
  severity: AuditSeverity;
  category: AuditCategory;
}

export interface AuditFilters {
  dateFrom: string;
  dateTo: string;
  category: AuditCategory | '';
  severity: AuditSeverity[];
  userId: string;
  search: string;
}

// ─── AI CONFIG ──────────────────────────────────────────────────────────────

export interface LoraAdapter {
  version: string;
  path: string;
  trainedAt: string;
  trainingExamples: number;
  trainingLoss: number;
  evalAccuracy: number;
  status: 'active' | 'available' | 'training' | 'rolledback';
  deployedAt?: string;
  improvementVsPrevious?: number;
}

export interface AIModelConfig {
  id: string;
  baseModel: string;
  displayName: string;
  provider: string;
  inferenceUrl: string;
  embeddingUrl: string;
  activeLoraVersion?: string;
  activeLoraPath?: string;
  availableLoras: LoraAdapter[];
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopP: number;
  contextWindowSize: number;
  status: 'online' | 'offline' | 'degraded' | 'training';
  gpuUtilization: number;
  lastHealthCheck: string;
  avgLatencyMs: number;
  requestsPerMinute: number;
}

export interface TrainingBatch {
  id: string;
  version: string;
  totalExamples: number;
  positiveExamples: number;
  correctedExamples: number;
  syntheticExamples: number;
  negativeExamples: number;
  status: 'queued' | 'preparing' | 'training' | 'evaluating' | 'deployed' | 'rolledback' | 'failed';
  progress: number;
  currentEpoch?: number;
  totalEpochs?: number;
  trainingLoss?: number;
  evalMetrics?: {
    accuracy: number;
    perplexity: number;
    groundedness: number;
    refusalAccuracy: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  deployedAt?: string;
  estimatedTimeRemaining?: number;
}

// ─── BILLING E USO ──────────────────────────────────────────────────────────

export interface UsageMetrics {
  period: string;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokensEmbedding: number;
  totalChatRequests: number;
  totalRagQueries: number;
  totalDocumentsProcessed: number;
  totalTrainingRuns: number;
  gpuHoursInference: number;
  gpuHoursTraining: number;
  gpuHoursEmbedding: number;
  storageDocumentsGb: number;
  storageVectorDbGb: number;
  storageModelsGb: number;
  estimatedCost: { gpu: number; storage: number; network: number; total: number; currency: string };
  byProject: { projectId: string; projectName: string; tokensUsed: number; chatCount: number; percentOfTotal: number }[];
  byUser: { userId: string; userName: string; tokensUsed: number; chatCount: number }[];
  activeUsers: number;
  chatsTrend?: number;
  chatsTrendPercent?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  api: boolean;
  database: boolean;
  vectorDb: boolean;
  gpu: boolean;
  embedding: boolean;
  uptimePercent: number;
  avgLatencyMs: number;
}

export interface GpuInfo {
  model: string;
  utilization: number;
  vramUsed: number;
  vramTotal: number;
  vramPercent: number;
  temperature: number;
  requestsPerMin: number;
  activeModel: string;
  activeLoraVersion: string;
  provider: string;
}

export interface AdminAlert {
  id: string;
  severity: AuditSeverity;
  title: string;
  description: string;
  actionLabel: string;
  actionType: string;
}
