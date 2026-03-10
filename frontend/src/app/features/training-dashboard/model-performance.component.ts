import {
  Component, OnInit, inject, signal
} from '@angular/core';
import { CommonModule, DatePipe, PercentPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

export interface ModelVersion {
  version: string;
  deployedAt: string;
  accuracy: number;
  avgResponseTime: number;
  thumbsUpPct: number;
  thumbsDownPct: number;
  totalInteractions: number;
  trainingExamples: number;
  isActive: boolean;
}

export interface BenchmarkResult {
  question: string;
  expectedKeywords: string[];
  v_before: { response: string; passed: boolean };
  v_after: { response: string; passed: boolean };
}

@Component({
  selector: 'app-model-performance',
  standalone: true,
  imports: [CommonModule, DatePipe, PercentPipe],
  template: `
    <div class="model-performance">
      <h3>&#128200; Performance do Modelo</h3>

      <!-- Versões -->
      <div class="versions-timeline">
        @for (v of versions(); track v.version) {
          <div class="version-card" [class.active]="v.isActive">
            @if (v.isActive) {
              <span class="active-badge">&#9679; ATIVO</span>
            }
            <h4>{{ v.version }}</h4>
            <div class="version-stats">
              <div class="stat">
                <span class="stat-label">Acurácia</span>
                <span class="stat-value">{{ v.accuracy | percent:'1.1-1' }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">&#128077; Rate</span>
                <span class="stat-value success">{{ v.thumbsUpPct | percent:'1.0-0' }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">&#128078; Rate</span>
                <span class="stat-value danger">{{ v.thumbsDownPct | percent:'1.0-0' }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Latência</span>
                <span class="stat-value">{{ v.avgResponseTime }}ms</span>
              </div>
              <div class="stat">
                <span class="stat-label">Interações</span>
                <span class="stat-value">{{ v.totalInteractions }}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Deploy</span>
                <span class="stat-value">{{ v.deployedAt | date:'dd/MM/yy' }}</span>
              </div>
            </div>

            @if (!v.isActive) {
              <button class="btn-compare" (click)="loadComparison(v.version)">
                &#128269; Comparar com ativo
              </button>
            }
          </div>
        }
      </div>

      <!-- Comparação antes/depois -->
      @if (comparison()) {
        <div class="comparison-section">
          <h4>&#128269; Comparação: {{ compareVersion() }} vs Ativo</h4>
          <div class="benchmark-list">
            @for (b of comparison()!; track b.question) {
              <div class="benchmark-row">
                <p class="benchmark-q"><strong>Q:</strong> {{ b.question }}</p>
                <div class="benchmark-cols">
                  <div class="benchmark-col" [class.passed]="b.v_before.passed" [class.failed]="!b.v_before.passed">
                    <span class="col-label">{{ compareVersion() }} {{ b.v_before.passed ? '&#9989;' : '&#10060;' }}</span>
                    <p>{{ b.v_before.response }}</p>
                  </div>
                  <div class="benchmark-col" [class.passed]="b.v_after.passed" [class.failed]="!b.v_after.passed">
                    <span class="col-label">Ativo {{ b.v_after.passed ? '&#9989;' : '&#10060;' }}</span>
                    <p>{{ b.v_after.response }}</p>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class ModelPerformanceComponent implements OnInit {
  private http = inject(HttpClient);
  private workspaceCtx = inject(WorkspaceContextService);

  versions = signal<ModelVersion[]>([]);
  comparison = signal<BenchmarkResult[] | null>(null);
  compareVersion = signal<string>('');

  ngOnInit(): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.http
      .get<ModelVersion[]>(`/api/admin/workspaces/${wsId}/model/versions`)
      .subscribe((v) => this.versions.set(v));
  }

  loadComparison(version: string): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.compareVersion.set(version);
    this.http
      .get<BenchmarkResult[]>(
        `/api/admin/workspaces/${wsId}/model/compare?v=${version}`
      )
      .subscribe((c) => this.comparison.set(c));
  }
}
