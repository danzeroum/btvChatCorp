import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/admin`;
const API  = `${environment.apiUrl}/api/v1`;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'suspended' | 'pending';
  lastLoginAt?: string;
  createdAt: string;
  mfaEnabled: boolean;
}

export interface AuditEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  severity: 'info' | 'warning' | 'critical';
  details: any;
  ipAddress: string;
  createdAt: string;
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

export interface ApiKeyAdmin {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: any[];
  status: 'active' | 'revoked' | 'expired';
  rateLimitRpm: number;
  lastUsedAt?: string;
  requestCount: number;
  expiresAt?: string;
  createdAt: string;
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

  // Users
  listUsers(page = 1, perPage = 20, search?: string): Observable<{ users: AdminUser[]; total: number }> {
    let params = new HttpParams().set('page', page).set('perPage', perPage);
    if (search) params = params.set('search', search);
    return this.http.get<{ users: AdminUser[]; total: number }>(`${BASE}/users`, { params });
  }

  inviteUser(email: string, role: string): Observable<void> {
    return this.http.post<void>(`${BASE}/users`, { email, role });
  }

  updateUserRole(userId: string, role: string): Observable<void> {
    return this.http.put<void>(`${BASE}/users/${userId}`, { role });
  }

  suspendUser(userId: string): Observable<void> {
    return this.http.post<void>(`${BASE}/users/${userId}/suspend`, {});
  }

  activateUser(userId: string): Observable<void> {
    return this.http.post<void>(`${BASE}/users/${userId}/activate`, {});
  }

  // Audit
  queryAuditLogs(
    page = 1, perPage = 50,
    severity?: string, action?: string, since?: string,
  ): Observable<{ entries: AuditEntry[]; total: number }> {
    let params = new HttpParams().set('page', page).set('perPage', perPage);
    if (severity) params = params.set('severity', severity);
    if (action)   params = params.set('action', action);
    if (since)    params = params.set('since', since);
    return this.http.get<{ entries: AuditEntry[]; total: number }>(`${BASE}/audit`, { params });
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

  createApiKey(payload: Partial<ApiKeyAdmin>): Observable<{ key: string; id: string }> {
    return this.http.post<{ key: string; id: string }>(`${BASE}/api-keys`, payload);
  }

  revokeApiKey(id: string): Observable<void> {
    return this.http.post<void>(`${BASE}/api-keys/${id}/revoke`, {});
  }

  rotateApiKey(id: string): Observable<{ key: string }> {
    return this.http.post<{ key: string }>(`${BASE}/api-keys/${id}/rotate`, {});
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
}
