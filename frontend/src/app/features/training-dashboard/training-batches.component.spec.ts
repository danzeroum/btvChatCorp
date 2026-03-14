import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { TrainingBatchesComponent } from './training-batches.component';
import { TrainingService, TrainingBatch, BatchStatus } from './training.service';

const mockBatch: TrainingBatch = {
  id: 'b1', workspace_id: 'ws1', base_model: 'llama3.1:8b',
  previous_lora_version: null, new_lora_version: null,
  status: 'running', total_examples: 50, positive_examples: 40,
  corrected_examples: 10, progress: 30, current_epoch: 1, total_epochs: 3,
  training_loss: 0.4, eval_accuracy: null, external_job_id: 'mock-job',
  error_message: null, created_at: '2026-01-01T00:00:00Z',
  started_at: null, completed_at: null, deployed_at: null,
};

const mockStatus: BatchStatus = {
  id: 'b1', status: 'running', progress: 50,
  current_epoch: 2, total_epochs: 3, training_loss: 0.3,
  eval_accuracy: null, error_message: null,
};

describe('TrainingBatchesComponent', () => {
  let fixture: ComponentFixture<TrainingBatchesComponent>;
  let component: TrainingBatchesComponent;
  let svcSpy: jasmine.SpyObj<TrainingService>;

  beforeEach(async () => {
    svcSpy = jasmine.createSpyObj('TrainingService', [
      'getBatches', 'startBatch', 'getBatchStatus', 'pollBatchStatus',
    ]);
    svcSpy.getBatches.and.returnValue(of([mockBatch]));
    svcSpy.startBatch.and.returnValue(of({ ...mockBatch, status: 'running' }));
    svcSpy.getBatchStatus.and.returnValue(of(mockStatus));
    svcSpy.pollBatchStatus.and.returnValue(of(mockStatus));

    await TestBed.configureTestingModule({
      imports: [TrainingBatchesComponent],
      providers: [{ provide: TrainingService, useValue: svcSpy }],
    }).compileComponents();

    fixture   = TestBed.createComponent(TrainingBatchesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carrega batches no init', () => {
    expect(svcSpy.getBatches).toHaveBeenCalled();
    expect(component.batches().length).toBe(1);
    expect(component.loading()).toBeFalse();
  });

  it('renderiza o batch na lista', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('llama3.1:8b');
  });

  it('startBatch() chama service e adiciona batch na lista', () => {
    component.startBatch();
    expect(svcSpy.startBatch).toHaveBeenCalledWith({ base_model: 'llama3.1:8b', total_epochs: 3 });
    expect(component.batches().length).toBe(2);
  });

  it('startBatch() mostra erro quando service falha', () => {
    svcSpy.startBatch.and.returnValue(
      throwError(() => ({ error: { message: 'Sem exemplos aprovados' } }))
    );
    component.startBatch();
    expect(component.error()).toBe('Sem exemplos aprovados');
    expect(component.starting()).toBeFalse();
  });

  it('statusLabel() retorna label em portugues', () => {
    expect(component.statusLabel('running')).toBe('Treinando');
    expect(component.statusLabel('completed')).toBe('Concluído');
    expect(component.statusLabel('failed')).toBe('Falhou');
  });

  it('stopPoll() limpa activePoll', () => {
    component.activePoll.set(mockStatus);
    component.stopPoll();
    expect(component.activePoll()).toBeNull();
  });
});
