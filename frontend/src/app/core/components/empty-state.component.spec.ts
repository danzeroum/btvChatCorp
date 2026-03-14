import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;
  let component: EmptyStateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();
    fixture   = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renderiza titulo e descricao', () => {
    component.title       = 'Lista vazia';
    component.description = 'Adicione itens para comecar.';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-title')!.textContent).toContain('Lista vazia');
    expect(el.querySelector('.empty-description')!.textContent).toContain('Adicione itens');
  });

  it('nao renderiza botao quando actionLabel esta vazio', () => {
    component.actionLabel = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-action')).toBeNull();
  });

  it('emite evento action ao clicar no botao', () => {
    component.actionLabel = 'Criar';
    fixture.detectChanges();
    let emitted = false;
    component.action.subscribe(() => (emitted = true));
    fixture.nativeElement.querySelector('.empty-action').click();
    expect(emitted).toBeTrue();
  });
});
