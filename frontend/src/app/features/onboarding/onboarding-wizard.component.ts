import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { OnboardingState } from './onboarding.model';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="onboarding-container">
      <!-- Progress bar -->
      <div class="progress-bar">
        @for (step of steps; track step.num) {
          <div class="step" [class.active]="currentStep === step.num"
               [class.completed]="state.completedSteps.includes(step.num)">
            <span class="step-num">{{ step.num }}</span>
            <span class="step-label">{{ step.label }}</span>
          </div>
        }
      </div>

      <!-- Step 1: Workspace -->
      @if (currentStep === 1) {
        <div class="step-content">
          <h2>🎉 Bem-vindo! Vamos configurar seu workspace.</h2>
          <div class="field">
            <label>Nome da empresa</label>
            <input [(ngModel)]="state.workspace.name" placeholder="Minha Empresa S.A.">
          </div>
          <div class="field">
            <label>Subdomínio</label>
            <div class="subdomain-row">
              <input [(ngModel)]="state.workspace.subdomain" placeholder="minhaempresa">
              <span>.aiplatform.com</span>
            </div>
          </div>
          <button class="next-btn" (click)="next()">Próximo →</button>
        </div>
      }

      <!-- Step 2: Branding -->
      @if (currentStep === 2) {
        <div class="step-content">
          <h2>🎨 Identidade visual</h2>
          <div class="field">
            <label>Logo</label>
            <input type="file" accept="image/*" (change)="onLogoUpload($event)">
          </div>
          <div class="field">
            <label>Cor primária</label>
            <input type="color" [(ngModel)]="state.branding.primaryColor" value="#2563EB">
          </div>
          <div class="field">
            <label>Cor secundária</label>
            <input type="color" [(ngModel)]="state.branding.secondaryColor" value="#7C3AED">
          </div>
          <!-- Preview ao vivo -->
          <div class="live-preview"
               [style.border-color]="state.branding.primaryColor">
            <div class="preview-header"
                 [style.background-color]="state.branding.primaryColor">
              @if (state.branding.logoUrl) {
                <img [src]="state.branding.logoUrl" alt="Logo" height="32">
              }
              <span>{{ state.workspace.name || 'Minha Empresa AI' }}</span>
            </div>
            <div class="preview-body">Chat • Docs • Config</div>
          </div>
          <div class="nav-btns">
            <button (click)="prev()">← Voltar</button>
            <button class="next-btn" (click)="next()">Próximo →</button>
          </div>
        </div>
      }

      <!-- Step 3: Autenticação -->
      @if (currentStep === 3) {
        <div class="step-content">
          <h2>🔐 Como seus colaboradores vão acessar?</h2>
          <div class="auth-options">
            @for (opt of authOptions; track opt.value) {
              <label class="auth-card" [class.selected]="state.auth.method === opt.value">
                <input type="radio" [(ngModel)]="state.auth.method" [value]="opt.value">
                <span>{{ opt.label }}</span>
                <small>{{ opt.description }}</small>
              </label>
            }
          </div>
          <div class="field" *ngIf="state.auth.method !== 'email'">
            <label>Domínio de email</label>
            <input [(ngModel)]="state.auth.domain" placeholder="empresa.com.br">
          </div>
          <div class="nav-btns">
            <button (click)="prev()">← Voltar</button>
            <button class="next-btn" (click)="next()">Próximo →</button>
          </div>
        </div>
      }

      <!-- Step 4: Primeiro Projeto -->
      @if (currentStep === 4) {
        <div class="step-content">
          <h2>🎯 Crie seu primeiro projeto de IA</h2>
          <div class="templates-grid">
            @for (tmpl of projectTemplates; track tmpl.id) {
              <div class="template-card"
                   [class.selected]="state.project.template === tmpl.id"
                   (click)="selectTemplate(tmpl.id)">
                <span class="icon">{{ tmpl.icon }}</span>
                <strong>{{ tmpl.name }}</strong>
                <p>{{ tmpl.description }}</p>
              </div>
            }
          </div>
          <div class="field">
            <label>Nome do projeto</label>
            <input [(ngModel)]="state.project.name" placeholder="Base de Conhecimento Principal">
          </div>
          <div class="nav-btns">
            <button (click)="prev()">← Voltar</button>
            <button class="next-btn" (click)="next()">Próximo →</button>
          </div>
        </div>
      }

      <!-- Step 5: Documentos -->
      @if (currentStep === 5) {
        <div class="step-content">
          <h2>📄 Envie seus primeiros documentos</h2>
          <div class="upload-area" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
            <p>📂 Arraste documentos ou clique para selecionar</p>
            <small>PDF, DOCX, TXT, CSV — até 50MB por arquivo</small>
            <input type="file" multiple accept=".pdf,.docx,.txt,.csv"
                   (change)="onFileSelect($event)">
          </div>
          @if (state.documents.uploadedIds.length > 0) {
            <p class="success">✅ {{ state.documents.uploadedIds.length }} documento(s) enviado(s)</p>
          }
          <div class="nav-btns">
            <button (click)="prev()">← Voltar</button>
            <button class="skip-btn" (click)="skip()">Pular por agora</button>
            <button class="next-btn" (click)="next()">Próximo →</button>
          </div>
        </div>
      }

      <!-- Step 6: Teste no Chat -->
      @if (currentStep === 6) {
        <div class="step-content">
          <h2>🤖 Teste agora!</h2>
          <p>Faça uma pergunta para ver a IA em ação com seus documentos.</p>
          <div class="sample-questions">
            @for (q of sampleQuestions; track q) {
              <button class="sample-q" (click)="testQuestion = q">{{ q }}</button>
            }
          </div>
          <div class="test-chat">
            <input [(ngModel)]="testQuestion" placeholder="Digite uma pergunta...">
            <button (click)="testChat()">Perguntar</button>
          </div>
          @if (testResponse) {
            <div class="test-response">
              <strong>Resposta:</strong>
              <p>{{ testResponse }}</p>
              <p class="aha-moment">🎉 Parabéns! Sua IA já está funcionando!</p>
            </div>
          }
          <div class="nav-btns">
            <button (click)="prev()">← Voltar</button>
            <button class="next-btn" (click)="next()">Próximo →</button>
          </div>
        </div>
      }

      <!-- Step 7: Equipe -->
      @if (currentStep === 7) {
        <div class="step-content">
          <h2>👥 Convide sua equipe</h2>
          <div class="invite-list">
            @for (email of state.team.invitedEmails; track email; let i = $index) {
              <div class="invite-row">
                <input [(ngModel)]="state.team.invitedEmails[i]" placeholder="email@empresa.com.br">
                <button (click)="removeEmail(i)">✕</button>
              </div>
            }
          </div>
          <button (click)="addEmail()">+ Adicionar email</button>
          <div class="nav-btns">
            <button (click)="prev()">← Voltar</button>
            <button class="skip-btn" (click)="skip()">Pular por agora</button>
            <button class="finish-btn" (click)="finish()">✨ Concluir onboarding!</button>
          </div>
        </div>
      }
    </div>
  `
})
export class OnboardingWizardComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentStep = 1;
  testQuestion = '';
  testResponse = '';

  state: OnboardingState = {
    workspaceId: '',
    currentStep: 1,
    completedSteps: [],
    workspace: {},
    branding: { primaryColor: '#2563EB', secondaryColor: '#7C3AED' },
    auth: { method: 'google', autoProvision: true },
    project: {},
    documents: { uploadedIds: [] },
    team: { invitedEmails: [''] },
    startedAt: new Date().toISOString(),
    skippedSteps: [],
  };

  steps = [
    { num: 1, label: 'Workspace' },
    { num: 2, label: 'Visual' },
    { num: 3, label: 'Acesso' },
    { num: 4, label: 'Projeto' },
    { num: 5, label: 'Documentos' },
    { num: 6, label: 'Teste' },
    { num: 7, label: 'Equipe' },
  ];

  authOptions = [
    { value: 'email', label: '📧 Email e Senha', description: 'Simples, sem integração' },
    { value: 'google', label: '🔵 Google Workspace', description: 'Recomendado' },
    { value: 'microsoft', label: '🔷 Microsoft 365 / Entra ID', description: 'SSO corporativo' },
    { value: 'saml', label: '🔐 SAML 2.0 (Okta, OneLogin, ADFS)', description: 'Enterprise' },
  ];

  projectTemplates = [
    { id: 'customer-support', icon: '📋', name: 'Atendimento ao Cliente', description: 'FAQ e políticas' },
    { id: 'document-analysis', icon: '📄', name: 'Análise de Documentos', description: 'Contratos e relatórios' },
    { id: 'hr-knowledge-base', icon: '💼', name: 'RH / Base de Conhecimento', description: 'Políticas internas' },
    { id: 'legal-compliance', icon: '⚖️', name: 'Jurídico / Compliance', description: 'Legislação e normas' },
    { id: 'tech-support', icon: '🔧', name: 'Suporte Técnico', description: 'Documentação técnica' },
    { id: 'custom', icon: '🎯', name: 'Customizado', description: 'Configuração manual' },
  ];

  sampleQuestions: string[] = [];

  ngOnInit(): void {
    this.http.get<{ workspaceId: string }>('/api/onboarding/state')
      .subscribe(r => this.state.workspaceId = r.workspaceId);
  }

  next(): void {
    this.saveStep();
    if (!this.state.completedSteps.includes(this.currentStep)) {
      this.state.completedSteps.push(this.currentStep);
    }
    this.currentStep++;
  }

  prev(): void { this.currentStep--; }

  skip(): void {
    this.state.skippedSteps.push(this.currentStep);
    this.currentStep++;
  }

  saveStep(): void {
    this.http.post('/api/onboarding/step', {
      step: this.currentStep,
      data: this.state,
    }).subscribe();
  }

  selectTemplate(id: string): void {
    this.state.project.template = id;
    const tmpl = this.projectTemplates.find(t => t.id === id);
    if (tmpl) this.state.project.name = tmpl.name;
  }

  onLogoUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => this.state.branding.logoUrl = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  onFileSelect(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    this.http.post<{ ids: string[] }>('/api/onboarding/documents', formData)
      .subscribe(r => this.state.documents.uploadedIds.push(...r.ids));
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files) return;
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    this.http.post<{ ids: string[] }>('/api/onboarding/documents', formData)
      .subscribe(r => this.state.documents.uploadedIds.push(...r.ids));
  }

  testChat(): void {
    if (!this.testQuestion.trim()) return;
    this.http.post<{ response: string }>('/api/chat/test', {
      message: this.testQuestion,
      projectId: this.state.project.template,
    }).subscribe(r => this.testResponse = r.response);
  }

  addEmail(): void { this.state.team.invitedEmails.push(''); }
  removeEmail(i: number): void { this.state.team.invitedEmails.splice(i, 1); }

  finish(): void {
    this.http.post('/api/onboarding/complete', this.state).subscribe(() => {
      this.router.navigate(['/dashboard']);
    });
  }
}
