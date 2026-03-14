import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';

import { TrainingService, TrainingInteraction, TrainingBatch, BatchStatus } from './training.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/api/v1`;

const mockInteraction: TrainingInteraction = {
  id: 'int-1',
  user_message: 'Qual o prazo?',
  assistant_response: '12 meses.',
  user_rating: 'positive',
  user_correction: null,
  feedback_categories: null,
  curator_status: 'pending',
  data_classification: 'internal',
  created_at: '2026-01-01T00:00:00Z',
};

const mockBatch: TrainingBatch = {
  id: 'batch-1',
  workspace_id: 'ws-1',
  base_model: 'llama3.1:8b',
  previous_lora_version: null,
  new_lora_version: null,
  status: 'running',
  total_examples: 50,
  positive_examples: 40,
  corrected_examples: 10,
  progress: 42,
  current_epoch: 1,
  total_epochs: 3,
  training_loss: 0.35,
  eval_accuracy: null,
  external_job_id: 'mock-job-batch-1',
  error_message: null,
  created_at: '2026-01-01T00:00:00Z',
  started_at: '2026-01-01T00:01:00Z',
  completed_at: null,
  deployed_at: null,
};

const mockStatus: BatchStatus = {
  id: 'batch-1',
  status: 'running',
  progress: 42,
  current_epoch: 1,
  total_epochs: 3,
  training_loss: 0.35,
  eval_accuracy: null,
  error_message: null,
};

describe('TrainingService', () => {
  let service: TrainingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrainingService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getQueue() faz GET /training/queue sem parametros', () => {
    service.getQueue().subscribe(items => {
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('int-1');
    });
    const req = http.expectOne(`${BASE}/training/queue`);
    expect(req.request.method).toBe('GET');
    req.flush([mockInteraction]);
  });

  it('getQueue() passa status como query param', () => {
    service.getQueue({ status: 'pending', page: 2, per_page: 10 }).subscribe();
    const req = http.expectOne(r => r.url === `${BASE}/training/queue`);
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.get('page')).toBe('2');
    req.flush([]);
  });

  it('approveInteraction() faz PUT /training/queue/:id/approve', () => {
    service.approveInteraction('int-1').subscribe();
    const req = http.expectOne(`${BASE}/training/queue/int-1/approve`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);
  });

  it('rejectInteraction() faz PUT /training/queue/:id/reject', () => {
    service.rejectInteraction('int-1').subscribe();
    const req = http.expectOne(`${BASE}/training/queue/int-1/reject`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);
  });

  it('getBatches() faz GET /training/batches', () => {
    service.getBatches().subscribe(batches => {
      expect(batches[0].status).toBe('running');
    });
    const req = http.expectOne(`${BASE}/training/batches`);
    expect(req.request.method).toBe('GET');
    req.flush([mockBatch]);
  });

  it('startBatch() faz POST /training/batches com dto', () => {
    service.startBatch({ base_model: 'llama3.1:8b', total_epochs: 2 }).subscribe(b => {
      expect(b.status).toBe('running');
    });
    const req = http.expectOne(`${BASE}/training/batches`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.base_model).toBe('llama3.1:8b');
    req.flush(mockBatch);
  });

  it('getBatchStatus() faz GET /training/batches/:id/status', () => {
    service.getBatchStatus('batch-1').subscribe(s => {
      expect(s.progress).toBe(42);
    });
    const req = http.expectOne(`${BASE}/training/batches/batch-1/status`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);
  });

  it('pollBatchStatus() para quando stop$ emite', fakeAsync(() => {
    const stop$ = new Subject<void>();
    const results: BatchStatus[] = [];

    service.pollBatchStatus('batch-1', 1000, stop$).subscribe(s => results.push(s));

    tick(1000);
    http.expectOne(`${BASE}/training/batches/batch-1/status`).flush(mockStatus);

    tick(1000);
    http.expectOne(`${BASE}/training/batches/batch-1/status`).flush(mockStatus);

    stop$.next();
    tick(1000);
    http.expectNone(`${BASE}/training/batches/batch-1/status`);

    expect(results.length).toBe(2);
  }));

  it('getDocuments() faz GET /training/documents', () => {
    service.getDocuments().subscribe();
    const req = http.expectOne(`${BASE}/training/documents`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
