import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorBannerComponent } from './error-banner.component';

describe('ErrorBannerComponent', () => {
  let fixture: ComponentFixture<ErrorBannerComponent>;
  let component: ErrorBannerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorBannerComponent],
    }).compileComponents();
    fixture   = TestBed.createComponent(ErrorBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('nao renderiza quando message e null', () => {
    component.message = null;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.error-banner')).toBeNull();
  });

  it('renderiza mensagem de erro com classe correta', () => {
    component.message  = 'Falha ao carregar dados';
    component.severity = 'error';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.error-banner--error')).toBeTruthy();
    expect(el.querySelector('.error-message')!.textContent).toContain('Falha ao carregar dados');
  });

  it('emite dismiss ao clicar no botao fechar', () => {
    component.message     = 'Erro';
    component.dismissible = true;
    fixture.detectChanges();
    let dismissed = false;
    component.dismiss.subscribe(() => (dismissed = true));
    fixture.nativeElement.querySelector('.error-dismiss').click();
    expect(dismissed).toBeTrue();
  });
});
