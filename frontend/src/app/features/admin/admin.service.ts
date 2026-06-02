import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/admin`;
// environment.apiUrl já inclui o prefixo `/api/v1`; não duplicar o segmento aqui.
const API  = environment.apiUrl;

// Espelha WorkspaceUserRow (backend, serializado em camelCase).
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roleName: string;
  status: string; // 'active' | 'suspended' | 'invited' | ...
  lastLoginAt?: string;
  lastLoginIp?: string;
  mfaEnabled: boolean;
  createdAt: string;
  // Campo transitório só de UI para o <select> de role (id da role atual).
  roleId?: string;
}

// Espelha RoleRow (backend).
export interface AdminRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: any;
  userCount?: number;
}

// Espelha AuditLogRow (backend).
export interface AuditEntry {
  id: string;
  createdAt: string;
  userId?: string;
  userName: string;
  userIp?: string;
  action: string;
  resourceName: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  details?: any;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  perPage: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded';
  api: string;
  database: string;
  vectorDb: string;
  gpu: string;
  embedding: string;
  uptimePercent: number;
  avgLatencyMs: number;
}

// Espelha ApiKeyRow (backend, camelCase).
export interface ApiKeyAdmin {
  id: string;
  name: string;
  prefix: string;
  maskedKey: string;
  permissions: any;
  rateLimit: number;
  expiresAt?: string;
  lastUsedAt?: string;
  usageToday?: number;
  usageTotal?: number;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  createdBy?: string;
  revokedAt?: string;
}

export interface SsoConfig {
  enabled: boolean;
  provider: 'google' | 'microsoft' | 'saml' | 'none';
  clientId?: string;
  tenantId?: string;
  samlMetadataUrl?: string;
  autoProvision: boolean;
  defaultRole: string;
}

// Espelha RagConfig (backend, camelCase).
export interface RagConfig {
  topK: number;
  chunkSize: number;
  chunkOverlap: number;
  similarityThreshold: number;
}

// ─── AI / LoRA models ─────────────────────────────────────────────

export interface AiModel {
  id: string;
  display_name: string;
  base_model: string;
  inference_url: string;
  status: 'active' | 'inactive' | 'loading';
  default_temperature: number;
  default_max_tokens: number;
  context_window_size: number;
  avg_latency_ms: number;
  requests_per_minute: number;
  gpu_utilization: number;
  active_lora_version: string | null;
}

export interface LoraAdapter {
  version: string;
  path: string;
  trained_at: string;
  training_examples: number;
  training_loss: number;
  eval_accuracy: number;
  status: 'pending' | 'ready' | 'active' | 'deprecated';
  deployed_at: string | null;
  improvement_vs_previous: number | null;
}

export interface ActivateLoraDto {
  model_id: string;
  lora_version: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  // Health
  getSystemHealth(): Observable<SystemHealth> {
    return this.http.get<SystemHealth>(`${BASE}/health`);
  }

  // Users — o backend retorna um array simples (sem envelope) e ignora paginação.
  listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${BASE}/users`);
  }

  listRoles(): Observable<AdminRole[]> {
    return this.http.get<AdminRole[]>(`${BASE}/roles`);
  }

  inviteUser(email: string, roleId: string, projectIds: string[] = []): Observable<unknown> {
    return this.http.post(`${BASE}/users`, { email, role_id: roleId, project_ids: projectIds });
  }

  updateUserRole(userId: string, roleId: string): Observable<unknown> {
    return this.http.put(`${BASE}/users/${userId}`, { role_id: roleId });
  }

  suspendUser(userId: string): Observable<void> {
    return this.http.post<void>(`${BASE}/users/${userId}/suspend`, {});
  }

  activateUser(userId: string): Observable<void> {
    return this.http.post<void>(`${BASE}/users/${userId}/activate`, {});
  }

  // Audit — o backend filtra por category, severity e user_id (snake_case).
  queryAuditLogs(
    page = 1, perPage = 50,
    severity?: string, category?: string,
  ): Observable<AuditPage> {
    let params = new HttpParams().set('page', page).set('per_page', perPage);
    if (severity) params = params.set('severity', severity);
    if (category) params = params.set('category', category);
    return this.http.get<AuditPage>(`${BASE}/audit`, { params });
  }

  exportAuditCsv(since: string, until: string): Observable<Blob> {
    return this.http.get(`${BASE}/audit/export`, {
      params: { since, until }, responseType: 'blob',
    });
  }

  // API Keys
  listApiKeys(): Observable<ApiKeyAdmin[]> {
    return this.http.get<ApiKeyAdmin[]>(`${BASE}/api-keys`);
  }

  createApiKey(payload: {
    name: string; rateLimit: number; permissions: string[]; expiresAt?: string;
  }): Observable<{ key: string; id: string }> {
    return this.http.post<{ key: string; id: string }>(`${BASE}/api-keys`, {
      name: payload.name,
      permissions: payload.permissions,
      rate_limit: payload.rateLimit,
      expires_at: payload.expiresAt,
    });
  }

  // Backend expõe revogação como PATCH /api-keys/:id/revoke.
  revokeApiKey(id: string): Observable<unknown> {
    return this.http.patch(`${BASE}/api-keys/${id}/revoke`, {});
  }

  // RAG config — GET/PUT /admin/ai/rag-config
  getRagConfig(): Observable<RagConfig> {
    return this.http.get<RagConfig>(`${BASE}/ai/rag-config`);
  }

  updateRagConfig(cfg: RagConfig): Observable<unknown> {
    return this.http.put(`${BASE}/ai/rag-config`, cfg);
  }

  // SSO
  getSsoConfig(): Observable<SsoConfig> {
    return this.http.get<SsoConfig>(`${BASE}/sso`);
  }

  updateSsoConfig(cfg: SsoConfig): Observable<void> {
    return this.http.put<void>(`${BASE}/sso`, cfg);
  }

  // Settings
  getSettings(): Observable<any> {
    return this.http.get(`${BASE}/settings`);
  }

  updateSettings(settings: any): Observable<void> {
    return this.http.put<void>(`${BASE}/settings`, settings);
  }

  // ── AI Models & LoRA Adapters

  listAiModels(): Observable<AiModel[]> {
    return this.http.get<AiModel[]>(`${API}/models`);
  }

  listLoraAdapters(): Observable<LoraAdapter[]> {
    return this.http.get<LoraAdapter[]>(`${API}/models/lora`);
  }

  activateLoraAdapter(dto: ActivateLoraDto): Observable<void> {
    return this.http.post<void>(`${API}/models/lora/activate`, dto);
  }

  setDefaultModel(modelId: string): Observable<void> {
    return this.http.put<void>(`${API}/models/${modelId}/default`, {});
  }

  reloadModel(modelId: string): Observable<void> {
    return this.http.post<void>(`${API}/models/${modelId}/reload`, {});
  }

  // Branding
  getBranding(): Observable<AdminBrandingConfig> {
    return this.http.get<AdminBrandingConfig>(`${BASE}/branding`);
  }

  updateBranding(config: AdminBrandingConfig): Observable<void> {
    return this.http.put<void>(`${BASE}/branding`, config);
  }

  verifyBrandingDomain(domain: string): Observable<{ status: 'pending' | 'verified' | 'failed' }> {
    return this.http.post<{ status: 'pending' | 'verified' | 'failed' }>(`${BASE}/branding/verify-domain`, { domain });
  }
}

export interface AdminBrandingConfig {
  productName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: 'inter' | 'roboto' | 'poppins' | 'custom';
  customFontUrl: string;
  customDomain: string | null;
  customDomainStatus: 'pending' | 'verified' | 'failed' | null;
  showPoweredBy: boolean;
  termsUrl: string;
  privacyUrl: string;
  supportEmail: string;
  features: {
    showTrainingSection: boolean;
    showBillingSection: boolean;
    showApiKeys: boolean;
    showAuditLog: boolean;
  };
}
