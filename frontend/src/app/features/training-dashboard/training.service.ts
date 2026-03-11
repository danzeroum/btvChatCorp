import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/training`;

export interface TrainingItem {
  id: string;
  userMessage: string;
  assistantResponse: string;
  userCorrection?: string;
  ragContext?: any;
  source: 'user_approved' | 'user_corrected' | 'synthetic_from_docs';
  priority: 'high' | 'normal';
  classification: string;
  piiDetected: boolean;
  curatorStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  finalAnswer?: string;  // editável pelo curador
}

export interface TrainingStats {
  pendingReview: number;
  approvedThisWeek: number;
  rejectedThisWeek: number;
  nextTrainingIn: string;
  currentLoraVersion: string;
  totalExamples: number;
}

export interface TrainingBatch {
  id: string;
  version: string;
  totalExamples: number;
  positiveExamples: number;
  correctedExamples: number;
  accuracy: number;
  status: 'queued' | 'training' | 'evaluating' | 'deployed' | 'rolled_back';
  deployedAt?: string;
  completedAt?: string;
}

export interface DataQualityMetrics {
  totalInteractions: number;
  eligibleForTraining: number;
  piiDetectedCount: number;
  averageRating: number;
  approvalRate: number;
  correctionRate: number;
  byClassification: Record<string, number>;
  bySource: Record<string, number>;
  dailyVolume: { date: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class TrainingService {
  private http = inject(HttpClient);

  getStats(workspaceId: string): Observable<TrainingStats> {
    return this.http.get<TrainingStats>(`${BASE}/stats`, { params: { workspaceId } });
  }

  getPendingItems(
    workspaceId: string,
    source?: string,
    priority?: string,
    page = 1,
    perPage = 20,
  ): Observable<{ items: TrainingItem[]; total: number }> {
    let params = new HttpParams()
      .set('workspaceId', workspaceId)
      .set('page', page)
      .set('perPage', perPage);
    if (source && source !== 'all') params = params.set('source', source);
    if (priority && priority !== 'all') params = params.set('priority', priority);
    return this.http.get<{ items: TrainingItem[]; total: number }>(`${BASE}/pending`, { params });
  }

  approveItem(id: string, finalAnswer?: string): Observable<void> {
    return this.http.post<void>(`${BASE}/items/${id}/approve`, { finalAnswer });
  }

  rejectItem(id: string, reason?: string): Observable<void> {
    return this.http.post<void>(`${BASE}/items/${id}/reject`, { reason });
  }

  bulkApprove(ids: string[]): Observable<void> {
    return this.http.post<void>(`${BASE}/items/bulk-approve`, { ids });
  }

  getBatches(workspaceId: string): Observable<TrainingBatch[]> {
    return this.http.get<TrainingBatch[]>(`${BASE}/batches`, { params: { workspaceId } });
  }

  triggerTraining(workspaceId: string): Observable<{ jobId: string }> {
    return this.http.post<{ jobId: string }>(`${BASE}/trigger`, { workspaceId });
  }

  getDataQuality(workspaceId: string): Observable<DataQualityMetrics> {
    return this.http.get<DataQualityMetrics>(`${BASE}/quality`, { params: { workspaceId } });
  }
}
