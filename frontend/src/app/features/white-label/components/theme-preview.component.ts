import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceBranding } from '../models/branding.model';

@Component({
  selector: 'app-theme-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-preview-wrapper">
      <div class="preview-label">&#128065;&#65039; Preview ao vivo</div>

      <div class="preview-shell"
        [style.--p]="'#' + branding?.theme?.primary"
        [style.--s]="'#' + branding?.theme?.secondary"
        [style.--bg]="'#' + branding?.theme?.background"
        [style.--surface]="'#' + branding?.theme?.surface"
        [style.--sidebar-bg]="'#' + branding?.theme?.sidebarBg"
        [style.--sidebar-text]="'#' + branding?.theme?.sidebarText"
        [style.--text]="'#' + branding?.theme?.textPrimary"
        [style.--text2]="'#' + branding?.theme?.textSecondary"
        [style.--border]="'#' + branding?.theme?.border"
        [style.--radius]="branding?.theme?.borderRadius"
        [style.font-family]="branding?.theme?.fontFamily">

        <!-- Sidebar -->
        <div class="prev-sidebar" [style.background]="'var(--sidebar-bg)'">
          @if (branding?.logoUrl) {
            <img [src]="branding!.logoUrl" class="prev-logo" alt="Logo" />
          } @else {
            <div class="prev-logo-placeholder" [style.background]="'var(--p)'">A</div>
          }
          <div class="prev-nav-items">
            @for (item of navItems; track item.label; let i = $index) {
              <div class="prev-nav-item"
                [class.active]="i === 0"
                [style.color]="i === 0 ? 'var(--p)' : 'var(--sidebar-text)'"
                [style.background]="i === 0 ? 'rgba(255,255,255,0.1)' : 'transparent'"
                [style.border-radius]="'var(--radius)'">
                {{ item.icon }} {{ item.label }}
              </div>
            }
          </div>
        </div>

        <!-- Main -->
        <div class="prev-main" [style.background]="'var(--bg)'">
          <!-- Header -->
          <div class="prev-header"
            [style.background]="'var(--surface)'"
            [style.border-bottom]="'1px solid var(--border)'">
            <span [style.color]="'var(--text)'">{{ branding?.platformName || 'Minha Empresa AI' }}</span>
            <div class="prev-avatar" [style.background]="'var(--p)'">M</div>
          </div>

          <!-- Chat area -->
          <div class="prev-chat">
            <!-- Bot welcome -->
            <div class="prev-msg bot">
              <div class="prev-bubble bot-bubble"
                [style.background]="'var(--surface)'"
                [style.color]="'var(--text)'"
                [style.border]="'1px solid var(--border)'"
                [style.border-radius]="'var(--radius)'">
                {{ branding?.chatWelcomeMessage || 'Olá! Como posso ajudar?' }}
              </div>
            </div>
            <!-- User msg -->
            <div class="prev-msg user">
              <div class="prev-bubble user-bubble"
                [style.background]="'var(--p)'"
                [style.color]="'white'"
                [style.border-radius]="'var(--radius)'">
                Qual o prazo de entrega?
              </div>
            </div>
            <!-- Bot response -->
            <div class="prev-msg bot">
              <div class="prev-bubble bot-bubble"
                [style.background]="'var(--surface)'"
                [style.color]="'var(--text)'"
                [style.border]="'1px solid var(--border)'"
                [style.border-radius]="'var(--radius)'">
                O prazo padrão é de 5 dias úteis...
                <div class="prev-source" [style.color]="'var(--p)'">&#128196; Manual de Produtos</div>
              </div>
            </div>
          </div>

          <!-- Input area -->
          <div class="prev-input-area"
            [style.background]="'var(--surface)'"
            [style.border-top]="'1px solid var(--border)'">
            <div class="prev-input"
              [style.border]="'1px solid var(--border)'"
              [style.border-radius]="'var(--radius)'"
              [style.color]="'var(--text2)'">
              {{ branding?.chatPlaceholder || 'Digite sua pergunta...' }}
            </div>
            <div class="prev-send-btn" [style.background]="'var(--p)'"
              [style.border-radius]="'var(--radius)'">&#8679;</div>
          </div>
        </div>
      </div>

      <!-- Badges de cor -->
      <div class="color-chips">
        @for (chip of colorChips; track chip.label) {
          <div class="color-chip" [title]="chip.label">
            <div class="chip-swatch" [style.background]="'#' + getColor(chip.key)"></div>
            <span>{{ chip.label }}</span>
          </div>
        }
      </div>
    </div>
  `
})
export class ThemePreviewComponent implements OnChanges {
  @Input() branding?: WorkspaceBranding;

  navItems = [
    { icon: '&#128172;', label: 'Chat' },
    { icon: '&#128196;', label: 'Documentos' },
    { icon: '&#128218;', label: 'Projetos' },
    { icon: '&#9881;&#65039;', label: 'Configurações' },
  ];

  colorChips = [
    { key: 'primary',   label: 'Primária' },
    { key: 'secondary', label: 'Secundária' },
    { key: 'sidebarBg', label: 'Sidebar' },
    { key: 'success',   label: 'Sucesso' },
    { key: 'error',     label: 'Erro' },
  ];

  getColor(key: string): string {
    return (this.branding?.theme as any)?.[key] ?? 'e5e7eb';
  }

  ngOnChanges(): void {
    // Reativo via bindings de template
  }
}
