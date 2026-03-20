import {
  Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  route: string;
  completed: boolean;
  checkFn: (ws: WorkspaceStatus) => boolean;
}

interface WorkspaceStatus {
  branding?: { logoUrl?: string };
  sso?: { enabledProviders?: Record<string, boolean> };
  projectCount: number;
  documentCount: number;
  chatCount: number;
  userCount: number;
  connectorCount: number;
  apiKeyCount: number;
  checklistDismissed: boolean;
}

@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showChecklist() && !dismissed()) {
      <div class="onboarding-checklist" [class.minimized]="isMinimized()">
        @if (!isMinimized()) {
          <div class="checklist-header">
            <div>
              <h3>Configuração do Workspace</h3>
              <p>{{ completedCount() }}/{{ items.length }} concluídos</p>
            </div>
            <div class="checklist-actions">
              <button (click)="isMinimized.set(true)" title="Minimizar">−</button>
              <button (click)="dismiss()" title="Dispensar">×</button>
            </div>
          </div>

          <div class="checklist-progress">
            <div class="progress-bar">
              <div class="progress-fill"
                   [style.width.%]="progressPercent()"
                   style="background: var(--color-primary)">
              </div>
            </div>
          </div>

          <div class="checklist-items">
            @for (item of items; track item.id) {
              <div class="checklist-item"
                   [class.completed]="item.completed"
                   (click)="navigateTo(item)">
                <span class="check-icon">{{ item.completed ? '✓' : '○' }}</span>
                <div class="item-content">
                  <span class="item-title">{{ item.title }}</span>
                  <span class="item-description">{{ item.description }}</span>
                </div>
                @if (!item.completed) {
                  <span class="item-arrow">›</span>
                }
              </div>
            }
          </div>
        } @else {
          <button class="checklist-fab"
                  (click)="isMinimized.set(false)"
                  [title]="completedCount() + '/' + items.length + ' configurações concluídas'">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" stroke-width="3"/>
              <circle cx="18" cy="18" r="16" fill="none"
                      stroke="var(--color-primary)" stroke-width="3"
                      [attr.stroke-dasharray]="circumference"
                      [attr.stroke-dashoffset]="dashOffset"
                      transform="rotate(-90 18 18)"/>
            </svg>
            <span class="fab-text">{{ completedCount() }}/{{ items.length }}</span>
          </button>
        }
      </div>
    }
  `,
})
export class OnboardingChecklistComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly isMinimized = signal(false);
  readonly showChecklist = signal(true);
  readonly dismissed = signal(false);

  items: ChecklistItem[] = [
    {
      id: 'branding',
      title: 'Personalizar identidade visual',
      description: 'Logo, cores e nome da plataforma',
      route: '/admin/branding',
      completed: false,
      checkFn: (ws) => !!ws.branding?.logoUrl,
    },
    {
      id: 'sso',
      title: 'Configurar autenticação SSO',
      description: 'Google, Microsoft ou SAML',
      route: '/admin/integrations/sso',
      completed: false,
      checkFn: (ws) =>
        !!(ws.sso?.enabledProviders?.['google'] ||
           ws.sso?.enabledProviders?.['microsoft'] ||
           ws.sso?.enabledProviders?.['saml']),
    },
    {
      id: 'first-project',
      title: 'Criar primeiro projeto',
      description: 'Configure um assistente de IA para seu caso de uso',
      route: '/projects/new',
      completed: false,
      checkFn: (ws) => ws.projectCount > 0,
    },
    {
      id: 'upload-docs',
      title: 'Enviar pelo menos 5 documentos',
      description: 'Alimente a IA com conhecimento da empresa',
      route: '/documents/upload',
      completed: false,
      checkFn: (ws) => ws.documentCount >= 5,
    },
    {
      id: 'test-chat',
      title: 'Testar o chat com a IA',
      description: 'Faça perguntas e veja as respostas com fontes',
      route: '/chat',
      completed: false,
      checkFn: (ws) => ws.chatCount > 0,
    },
    {
      id: 'invite-team',
      title: 'Convidar pelo menos 3 pessoas',
      description: 'Traga sua equipe para a plataforma',
      route: '/admin/users',
      completed: false,
      checkFn: (ws) => ws.userCount >= 3,
    },
    {
      id: 'connector',
      title: 'Conectar uma fonte de dados',
      description: 'Google Drive, SharePoint, Confluence ou outro',
      route: '/admin/connectors',
      completed: false,
      checkFn: (ws) => ws.connectorCount > 0,
    },
    {
      id: 'api-key',
      title: 'Criar uma API key',
      description: 'Para integrar com outros sistemas',
      route: '/admin/integrations/api-keys',
      completed: false,
      checkFn: (ws) => ws.apiKeyCount > 0,
    },
  ];

  readonly completedCount = computed(() => this.items.filter(i => i.completed).length);
  readonly progressPercent = computed(() => (this.completedCount() / this.items.length) * 100);
  readonly circumference = 2 * Math.PI * 16;
  get dashOffset(): number {
    return this.circumference * (1 - this.progressPercent() / 100);
  }

  async ngOnInit() {
    const status = await firstValueFrom(
      this.http.get<WorkspaceStatus>('/api/admin/workspace/status')
    );
    this.items.forEach(item => (item.completed = item.checkFn(status)));
    this.dismissed.set(status.checklistDismissed);
    if (this.completedCount() === this.items.length) {
      this.showChecklist.set(false);
    }
  }

  navigateTo(item: ChecklistItem) {
    this.router.navigateByUrl(item.route);
  }

  async dismiss() {
    this.dismissed.set(true);
    await firstValueFrom(this.http.post('/api/admin/workspace/checklist/dismiss', {}));
  }
}
