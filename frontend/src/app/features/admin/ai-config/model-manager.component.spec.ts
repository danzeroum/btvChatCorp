import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ModelManagerComponent } from './model-manager.component';
import { AdminService, AiModel, LoraAdapter } from '../admin.service';

const mockModel: AiModel = {
  id: 'model-1',
  display_name: 'LLaMA 3.1 8B',
  base_model: 'llama3.1:8b',
  inference_url: 'http://ollama:11434',
  status: 'active',
  default_temperature: 0.7,
  default_max_tokens: 2048,
  context_window_size: 4096,
  avg_latency_ms: 350,
  requests_per_minute: 60,
  gpu_utilization: 42,
  active_lora_version: null,
};

const mockAdapter: LoraAdapter = {
  version: 'v1.0',
  path: '/models/lora/v1.0',
  trained_at: '2026-01-01T00:00:00Z',
  training_examples: 120,
  training_loss: 0.32,
  eval_accuracy: 0.87,
  status: 'ready',
  deployed_at: null,
  improvement_vs_previous: 0.05,
};

describe('ModelManagerComponent', () => {
  let fixture: ComponentFixture<ModelManagerComponent>;
  let component: ModelManagerComponent;
  let svcSpy: jasmine.SpyObj<AdminService>;

  beforeEach(async () => {
    svcSpy = jasmine.createSpyObj('AdminService', [
      'listAiModels', 'listLoraAdapters', 'activateLoraAdapter',
      'setDefaultModel', 'reloadModel',
    ]);
    svcSpy.listAiModels.and.returnValue(of([mockModel]));
    svcSpy.listLoraAdapters.and.returnValue(of([mockAdapter]));
    svcSpy.activateLoraAdapter.and.returnValue(of(undefined));
    svcSpy.setDefaultModel.and.returnValue(of(undefined));
    svcSpy.reloadModel.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [ModelManagerComponent],
      providers: [{ provide: AdminService, useValue: svcSpy }],
    }).compileComponents();

    fixture   = TestBed.createComponent(ModelManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => component.ngOnDestroy());

  it('carrega modelos e adapters no init', () => {
    expect(svcSpy.listAiModels).toHaveBeenCalled();
    expect(svcSpy.listLoraAdapters).toHaveBeenCalled();
    expect(component.models().length).toBe(1);
    expect(component.adapters().length).toBe(1);
    expect(component.loading()).toBeFalse();
  });

  it('renderiza nome do modelo e do adapter', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('LLaMA 3.1 8B');
    expect(el.textContent).toContain('v1.0');
  });

  it('activateAdapter() chama service com model_id e lora_version', () => {
    component.selectedModelId = 'model-1';
    component.activateAdapter(mockAdapter);
    expect(svcSpy.activateLoraAdapter).toHaveBeenCalledWith({
      model_id: 'model-1',
      lora_version: 'v1.0',
    });
  });

  it('setDefault() chama service e recarrega', () => {
    component.setDefault(mockModel);
    expect(svcSpy.setDefaultModel).toHaveBeenCalledWith('model-1');
    expect(svcSpy.listAiModels).toHaveBeenCalledTimes(2); // init + reload
  });

  it('exibe erro quando listAiModels falha', () => {
    svcSpy.listAiModels.and.returnValue(throwError(() => new Error('fail')));
    component.load();
    expect(component.error()).toBe('Erro ao carregar modelos.');
    expect(component.loading()).toBeFalse();
  });
});
