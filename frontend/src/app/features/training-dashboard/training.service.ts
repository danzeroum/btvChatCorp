import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, interval, Subject } from 'rxjs';
import { switchMap, takeUntil, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/api/v1`;

// ─── Models (espelham os structs do backend) ────────────────────────────────────

export interface TrainingInteraction {
  id: string;
  user_message: string;
  assistant_response: string;
  user_rating: 'positive' | 'negative' | null;
  user_correction: string | null;
  feedback_categories: string | null;
  curator_status: 'pending' | 'approved' | 'rejected';
  data_classification: string;
  created_at: string;
}

export interface TrainingBatch {
  id: string;
  workspace_id: string;
  base_model: string;
  previous_lora_version: string | null;
  new_lora_version: string | null;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_examples: number | null;
  positive_examples: number | null;
  corrected_examples: number | null;
  progress: number | null;
  current_epoch: number | null;
  total_epochs: number | null;
  training_loss: number | null;
  eval_accuracy: number | null;
  external_job_id: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  deployed_at: string | null;
}

export interface BatchStatus {
  id: string;
  status: string;
  progress: number | null;
  current_epoch: number | null;
  total_epochs: number | null;
  training_loss: number | null;
  eval_accuracy: number | null;
  error_message: string | null;
}

export interface TrainingDocument {
  id: string;
  document_name: string;
  chunk_text: string;
  generated_question: string;
  generated_answer: string;
  classification: string;
  curator_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface StartBatchDto {
  base_model?: string;
  total_epochs?: number;
}

export interface QueueQuery {
  status?: 'pending' | 'approved' | 'rejected';
  page?: number;
  per_page?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TrainingService {
  private http = inject(HttpClient);

  // ── Fila de curadoria

  getQueue(query: QueueQuery = {}): Observable<TrainingInteraction[]> {
    let params = new HttpParams();
    if (query.status)   params = params.set('status',   query.status);
    if (query.page)     params = params.set('page',     query.page);
    if (query.per_page) params = params.set('per_page', query.per_page);
    return this.http.get<TrainingInteraction[]>(`${BASE}/training/queue`, { params });
  }

  approveInteraction(id: string): Observable<void> {
    return this.http.put<void>(`${BASE}/training/queue/${id}/approve`, {});
  }

  rejectInteraction(id: string): Observable<void> {
    return this.http.put<void>(`${BASE}/training/queue/${id}/reject`, {});
  }

  // ── Batches

  getBatches(): Observable<TrainingBatch[]> {
    return this.http.get<TrainingBatch[]>(`${BASE}/training/batches`);
  }

  getBatch(id: string): Observable<TrainingBatch> {
    return this.http.get<TrainingBatch>(`${BASE}/training/batches/${id}`);
  }

  startBatch(dto: StartBatchDto = {}): Observable<TrainingBatch> {
    return this.http.post<TrainingBatch>(`${BASE}/training/batches`, dto);
  }

  getBatchStatus(id: string): Observable<BatchStatus> {
    return this.http.get<BatchStatus>(`${BASE}/training/batches/${id}/status`);
  }

  /**
   * Polling de status a cada `intervalMs` ms.
   * Para automaticamente quando `stop$` emite.
   */
  pollBatchStatus(
    id: string,
    intervalMs = 3000,
    stop$: Subject<void> = new Subject(),
  ): Observable<BatchStatus> {
    return interval(intervalMs).pipe(
      switchMap(() => this.getBatchStatus(id)),
      takeUntil(stop$),
      shareReplay(1),
    );
  }

  // ── Documentos sinteticos

  getDocuments(): Observable<TrainingDocument[]> {
    return this.http.get<TrainingDocument[]>(`${BASE}/training/documents`);
  }
}
