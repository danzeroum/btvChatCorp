import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  route: string;
  completed: boolean;
  checkFn: (ws: any) => boolean;
}

@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showChecklist && !dismissed) {
      <div class="onboarding-checklist" [class.minimized]="isMinimized">
        @if (!isMinimized) {
          <div class="checklist-header">
            <div>
              <h3>Configura\xE7\xE3o do Workspace</h3>
              <p>{{ completedCount() }}/{{ items.length }} conclu\xEDdos</p>
            </div>
            <div class="checklist-actions">
              <button (click)="isMinimized = true" title="Minimizar">&#8212;</button>
              <button (click)="dismiss()" title="Dispensar">&#10005;</button>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="checklist-progress">
            <div class="progress-bar">
              <div class="progress-fill"
                [style.width.%]="progressPercent()"
                [style.background]="'var(--color-primary)'">
              </div>
            </div>
          </div>

          <!-- Items -->
          <div class="checklist-items">
            @for (item of items; track item.id) {
              <div class="checklist-item" [class.completed]="item.completed"
                (click)="navigateTo(item)">
                <span class="check-icon">{{ item.completed ? '\u2705' : '\u25CB' }}</span>
                <div class="item-content">
                  <span class="item-title">{{ item.title }}</span>
                  <span class="item-description">{{ item.description }}</span>
                </div>
                @if (!item.completed) {
                  <span class="item-arrow">&#8250;</span>
                }
              </div>
            }
          </div>
        } @else {
          <!-- FAB minimizado -->
          <button class="checklist-fab" (click)="isMinimized = false">
            <svg viewBox="0 0 36 36" width="40" height="40">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" stroke-width="3"/>
              <circle cx="18" cy="18" r="16" fill="none"
                [attr.stroke]="'var(--color-primary)'" stroke-width="3"
                [attr.stroke-dasharray]="circumference()"
                [attr.stroke-dashoffset]="dashOffset()"
                transform="rotate(-90 18 18)"/>
            </svg>
            <span class="fab-text">{{ completedCount() }}/{{ items.length }}</span>
          </button>
        }
      </div>
    }
  `
})
export class OnboardingChecklistComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  showChecklist = true;
  isMinimized = false;
  dismissed = false;

  items: ChecklistItem[] = [
    { id: 'branding',     title: 'Personalizar identidade visual',   description: 'Logo, cores e nome da plataforma',             route: '/admin/branding',             completed: false, checkFn: (ws) => !!ws.branding?.logoUrl },
    { id: 'sso',          title: 'Configurar autentica\xE7\xE3o SSO', description: 'Google, Microsoft ou SAML',                    route: '/admin/integrations/sso',      completed: false, checkFn: (ws) => ws.sso?.enabledProviders?.google || ws.sso?.enabledProviders?.microsoft || ws.sso?.enabledProviders?.saml },
    { id: 'firstproject', title: 'Criar primeiro projeto',           description: 'Configure um assistente de IA',                route: '/projects/new',               completed: false, checkFn: (ws) => ws.projectCount > 0 },
    { id: 'uploaddocs',   title: 'Enviar pelo menos 5 documentos',   description: 'Alimente a IA com conhecimento da empresa',    route: '/documents/upload',           completed: false, checkFn: (ws) => ws.documentCount >= 5 },
    { id: 'testchat',     title: 'Testar o chat com a IA',           description: 'Fa\xE7a perguntas e veja as respostas',         route: '/chat',                        completed: false, checkFn: (ws) => ws.chatCount > 0 },
    { id: 'inviteteam',   title: 'Convidar pelo menos 3 pessoas',    description: 'Traga sua equipe para a plataforma',            route: '/admin/users',                completed: false, checkFn: (ws) => ws.userCount >= 3 },
    { id: 'connector',    title: 'Conectar uma fonte de dados',      description: 'Google Drive, SharePoint, Confluence ou outro', route: '/admin/connectors',           completed: false, checkFn: (ws) => ws.connectorCount > 0 },
    { id: 'apikey',       title: 'Criar uma API key',                description: 'Para integrar com outros sistemas',            route: '/admin/integrations/api-keys', completed: false, checkFn: (ws) => ws.apiKeyCount > 0 },
  ];

  completedCount = computed(() => this.items.filter((i) => i.completed).length);
  progressPercent = computed(() => (this.completedCount() / this.items.length) * 100);
  circumference = computed(() => 2 * Math.PI * 16);
  dashOffset = computed(() => this.circumference() * (1 - this.progressPercent() / 100));

  async ngOnInit(): Promise<void> {
    const status = await firstValueFrom(
      this.http.get<any>('/api/admin/workspace/status')
    );
    this.items.forEach((item) => (item.completed = item.checkFn(status)));
    if (status.checklistDismissed) this.showChecklist = false;
    if (this.completedCount() === this.items.length) this.showChecklist = false;
  }

  navigateTo(item: ChecklistItem): void {
    if (!item.completed) this.router.navigate([item.route]);
  }

  dismiss(): void {
    this.dismissed = true;
    this.http.post('/api/admin/workspace/checklist-dismiss', {}).subscribe();
  }
}
