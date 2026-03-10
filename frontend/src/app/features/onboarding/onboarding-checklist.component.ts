import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  route?: string;
  completed: boolean;
  priority: number;
}

@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (!dismissed && !allCompleted) {
      <div class="checklist-widget">
        <div class="checklist-header">
          <!-- Progress circular -->
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="16" fill="none" stroke="#e2e8f0" stroke-width="4"/>
            <circle cx="22" cy="22" r="16" fill="none"
                    [attr.stroke]="primaryColor"
                    stroke-width="4"
                    stroke-linecap="round"
                    [attr.stroke-dasharray]="circumference"
                    [attr.stroke-dashoffset]="dashOffset"
                    transform="rotate(-90 22 22)"/>
            <text x="22" y="27" text-anchor="middle" font-size="12" font-weight="bold">
              {{ completedCount }}/{{ items.length }}
            </text>
          </svg>
          <span class="title">Começando 🚀</span>
          <button class="dismiss-btn" (click)="dismissed = true">×</button>
        </div>

        <ul class="checklist-items">
          @for (item of items; track item.id) {
            <li [class.completed]="item.completed" (click)="navigate(item)">
              <span class="check-icon">{{ item.completed ? '✅' : '○' }}</span>
              <span>{{ item.label }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `
})
export class OnboardingChecklistComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  dismissed = false;
  primaryColor = '#2563EB';

  items: ChecklistItem[] = [
    { id: 'branding', label: 'Personalizar identidade visual', description: 'Logo e cores', route: '/admin/branding', completed: false, priority: 1 },
    { id: 'sso', label: 'Configurar SSO', description: 'Google, Microsoft ou SAML', route: '/admin/sso', completed: false, priority: 2 },
    { id: 'project', label: 'Criar primeiro projeto', description: 'Com template', route: '/projects/new', completed: false, priority: 3 },
    { id: 'documents', label: 'Fazer upload de documentos', description: 'Base de conhecimento', route: '/documents', completed: false, priority: 4 },
    { id: 'chat', label: 'Testar o chat', description: 'Momento aha!', route: '/chat', completed: false, priority: 5 },
    { id: 'team', label: 'Convidar equipe', description: 'Primeiros usuários', route: '/admin/users', completed: false, priority: 6 },
  ];

  get completedCount(): number { return this.items.filter(i => i.completed).length; }
  get allCompleted(): boolean { return this.completedCount === this.items.length; }
  get progressPercent(): number { return (this.completedCount / this.items.length) * 100; }
  get circumference(): number { return 2 * Math.PI * 16; }
  get dashOffset(): number { return this.circumference * (1 - this.progressPercent / 100); }

  ngOnInit(): void {
    this.http.get<{ [key: string]: boolean }>('/api/admin/workspace/checklist-status')
      .subscribe(status => {
        this.items.forEach(item => {
          item.completed = status[item.id] ?? false;
        });
      });
  }

  navigate(item: ChecklistItem): void {
    if (!item.completed && item.route) {
      this.router.navigate([item.route]);
    }
  }
}
