import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingSkeletonComponent } from './loading-skeleton.component';

describe('LoadingSkeletonComponent', () => {
  let fixture: ComponentFixture<LoadingSkeletonComponent>;
  let component: LoadingSkeletonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingSkeletonComponent],
    }).compileComponents();
    fixture   = TestBed.createComponent(LoadingSkeletonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renderiza skeleton de linhas por padrao', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.sk-line').length).toBe(3);
  });

  it('renderiza skeleton de tabela quando variant=table', () => {
    component.variant = 'table';
    component.rows    = 5;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.sk-row').length).toBe(5);
    expect(el.querySelector('.sk-header')).toBeTruthy();
  });
});
