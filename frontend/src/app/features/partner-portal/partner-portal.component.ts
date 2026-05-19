import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

interface Workspace {
  workspace_id: string;
  name: string;
  subdomain: string;
  url: string;
  status: string;
  created_at: string;
}

interface UsageResponse {
  period: string;
  total_messages: number;
  total_tokens: number;
  estimated_cost_brl: number;
  workspaces: Array<{
    workspace_id: string;
    name: string;
    messages: number;
    tokens: number;
  }>;
}

@Component({
  selector: 'app-partner-portal',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="partner-portal">
      <header class="portal-header">
        <h1>Portal de Parceiros BTV</h1>
        <nav>
          <button (click)="activeTab = 'workspaces'" [class.active]="activeTab === 'workspaces'">Workspaces</button>
          <button (click)="activeTab = 'usage'" [class.active]="activeTab === 'usage'">Uso &amp; Custos</button>
          <button (click)="activeTab = 'create'" [class.active]="activeTab === 'create'">Novo Workspace</button>
        </nav>
      </header>

      <!-- Workspaces List -->
      <section *ngIf="activeTab === 'workspaces'" class="tab-content">
        <h2>Seus Workspaces</h2>
        <div *ngIf="loading" class="loading">Carregando...</div>
        <div *ngIf="!loading" class="workspace-grid">
          <div *ngFor="let ws of workspaces" class="workspace-card">
            <div class="ws-header">
              <h3>{{ ws.name }}</h3>
              <span class="badge" [class]="'badge-' + ws.status">{{ ws.status }}</span>
            </div>
            <p class="ws-url"><a [href]="ws.url" target="_blank">{{ ws.url }}</a></p>
            <p class="ws-date">Criado em {{ ws.created_at | date:'dd/MM/yyyy' }}</p>
          </div>
          <div *ngIf="workspaces.length === 0" class="empty-state">
            <p>Nenhum workspace criado ainda.</p>
            <button (click)="activeTab = 'create'">Criar primeiro workspace</button>
          </div>
        </div>
      </section>

      <!-- Usage & Costs -->
      <section *ngIf="activeTab === 'usage'" class="tab-content">
        <h2>Uso e Custos — {{ usage?.period }}</h2>
        <div *ngIf="usage" class="usage-summary">
          <div class="kpi-card">
            <span class="kpi-label">Total de Mensagens</span>
            <span class="kpi-value">{{ usage.total_messages | number }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total de Tokens</span>
            <span class="kpi-value">{{ usage.total_tokens | number }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Custo Estimado</span>
            <span class="kpi-value">R$ {{ usage.estimated_cost_brl | number:'1.2-2' }}</span>
          </div>
        </div>
        <table *ngIf="usage?.workspaces?.length" class="usage-table">
          <thead>
            <tr><th>Workspace</th><th>Mensagens</th><th>Tokens</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let ws of usage.workspaces">
              <td>{{ ws.name }}</td>
              <td>{{ ws.messages | number }}</td>
              <td>{{ ws.tokens | number }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Create Workspace -->
      <section *ngIf="activeTab === 'create'" class="tab-content">
        <h2>Novo Workspace White-Label</h2>
        <form [formGroup]="createForm" (ngSubmit)="createWorkspace()" class="create-form">
          <label>
            Nome do Cliente
            <input formControlName="name" placeholder="Empresa ABC" />
            <span *ngIf="createForm.get('name')?.errors?.['required'] && createForm.get('name')?.touched"
              class="error">Nome obrigatorio</span>
          </label>
          <label>
            Subdominio
            <div class="subdomain-input">
              <input formControlName="subdomain" placeholder="empresa-abc" />
              <span class="domain-suffix">.btvc.com</span>
            </div>
            <span *ngIf="createForm.get('subdomain')?.errors?.['pattern']"
              class="error">Apenas letras minusculas, numeros e hifens</span>
          </label>
          <label>
            Cor Primaria
            <input type="color" formControlName="primary_color" value="#1a56db" />
          </label>
          <label>
            URL do Logo
            <input formControlName="logo_url" placeholder="https://..." />
          </label>
          <button type="submit" [disabled]="createForm.invalid || creating">
            {{ creating ? 'Criando...' : 'Criar Workspace' }}
          </button>
          <div *ngIf="createSuccess" class="success-message">
            Workspace criado! URL: <a [href]="createdUrl" target="_blank">{{ createdUrl }}</a>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: [`
    .partner-portal { max-width: 1000px; margin: 0 auto; padding: 2rem; font-family: sans-serif; }
    .portal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    nav button { margin-left: 0.5rem; padding: 0.5rem 1rem; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; }
    nav button.active { background: #1a56db; color: white; border-color: #1a56db; }
    .tab-content { animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .workspace-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .workspace-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; }
    .ws-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 999px; }
    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-provisioning { background: #fef3c7; color: #92400e; }
    .kpi-card { display: inline-block; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.5rem; margin: 0.5rem; text-align: center; }
    .kpi-label { display: block; font-size: 0.85rem; color: #6b7280; }
    .kpi-value { display: block; font-size: 1.75rem; font-weight: bold; color: #111827; }
    .usage-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    .usage-table th, .usage-table td { border: 1px solid #e5e7eb; padding: 0.5rem 1rem; text-align: left; }
    .create-form label { display: block; margin-bottom: 1rem; font-size: 0.9rem; }
    .create-form input[type="text"], .create-form input:not([type="color"]) { display: block; width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 0.25rem; }
    .subdomain-input { display: flex; align-items: center; gap: 0.25rem; }
    .domain-suffix { color: #6b7280; white-space: nowrap; }
    .error { color: #dc2626; font-size: 0.8rem; }
    .success-message { color: #065f46; background: #d1fae5; padding: 0.75rem; border-radius: 4px; margin-top: 1rem; }
    button[type="submit"] { background: #1a56db; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    button[type="submit"]:disabled { opacity: 0.5; cursor: not-allowed; }
    .empty-state { text-align: center; padding: 2rem; color: #6b7280; }
  `]
})
export class PartnerPortalComponent implements OnInit {
  activeTab: 'workspaces' | 'usage' | 'create' = 'workspaces';
  workspaces: Workspace[] = [];
  usage: UsageResponse | null = null;
  loading = false;
  creating = false;
  createSuccess = false;
  createdUrl = '';

  createForm: FormGroup;

  constructor(private http: HttpClient, private fb: FormBuilder) {
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      subdomain: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      primary_color: ['#1a56db'],
      logo_url: ['']
    });
  }

  ngOnInit(): void {
    this.loadWorkspaces();
    this.loadUsage();
  }

  loadWorkspaces(): void {
    this.loading = true;
    this.http.get<Workspace[]>('/partner/workspaces').subscribe({
      next: (data) => { this.workspaces = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadUsage(): void {
    this.http.get<UsageResponse>('/partner/usage').subscribe({
      next: (data) => this.usage = data,
      error: () => {}
    });
  }

  createWorkspace(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.http.post<{ url: string }>('/partner/workspaces', this.createForm.value).subscribe({
      next: (data) => {
        this.creating = false;
        this.createSuccess = true;
        this.createdUrl = data.url;
        this.loadWorkspaces();
        setTimeout(() => this.createSuccess = false, 10000);
      },
      error: () => { this.creating = false; }
    });
  }
}
