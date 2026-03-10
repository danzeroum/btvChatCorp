import {
  Directive,
  Input,
  ElementRef,
  OnChanges,
  OnInit,
  inject,
  effect,
} from '@angular/core';
import { BrandingService } from '../services/branding.service';

type BrandedTarget =
  | 'primary-bg'        // background com cor primária
  | 'primary-text'      // texto com cor primária
  | 'primary-border'    // borda com cor primária
  | 'sidebar-bg'        // background da sidebar
  | 'sidebar-text'      // texto da sidebar
  | 'surface-bg'        // background de cards
  | 'gradient';         // gradiente primary→secondary

/**
 * Aplica dinamicamente variáveis de cor do tema da empresa ao elemento host.
 *
 * Uso:
 *   <button branded="primary-bg">Salvar</button>
 *   <nav branded="sidebar-bg">...</nav>
 *   <div branded="gradient">Hero Section</div>
 */
@Directive({
  selector: '[branded]',
  standalone: true,
})
export class BrandedDirective implements OnInit, OnChanges {
  @Input('branded') target: BrandedTarget = 'primary-bg';

  private el = inject(ElementRef);
  private brandingService = inject(BrandingService);

  constructor() {
    // Reage a mudanças de tema em tempo real (signal)
    effect(() => {
      const _ = this.brandingService.branding(); // track
      this.apply();
    });
  }

  ngOnInit(): void  { this.apply(); }
  ngOnChanges(): void { this.apply(); }

  private apply(): void {
    const el: HTMLElement = this.el.nativeElement;
    const theme = this.brandingService.branding()?.theme;
    if (!theme) return;

    // Limpa estilos anteriores
    el.style.removeProperty('background');
    el.style.removeProperty('background-image');
    el.style.removeProperty('color');
    el.style.removeProperty('border-color');

    switch (this.target) {
      case 'primary-bg':
        el.style.background = `#${theme.primary}`;
        el.style.color       = `#${theme.textOnPrimary}`;
        break;
      case 'primary-text':
        el.style.color = `#${theme.primary}`;
        break;
      case 'primary-border':
        el.style.borderColor = `#${theme.primary}`;
        break;
      case 'sidebar-bg':
        el.style.background = `#${theme.sidebarBg}`;
        el.style.color       = `#${theme.sidebarText}`;
        break;
      case 'sidebar-text':
        el.style.color = `#${theme.sidebarText}`;
        break;
      case 'surface-bg':
        el.style.background = `#${theme.surface}`;
        break;
      case 'gradient':
        el.style.backgroundImage =
          `linear-gradient(135deg, #${theme.primary} 0%, #${theme.secondary} 100%)`;
        el.style.color = `#${theme.textOnPrimary}`;
        break;
    }
  }
}
