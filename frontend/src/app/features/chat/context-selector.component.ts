import {
  Component, Input, Output, EventEmitter, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  sector: string;
  lastUpdated: string;
}

/**
 * Seletor de base de conhecimento (collection do Qdrant).
 * Permite ao usuário escolher qual contexto usar antes de iniciar o chat.
 */
@Component({
  selector: 'app-context-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="context-selector">
      <label class="context-label">\uD83D\uDDC2\uFE0F Base de conhecimento:</label>

      <div class="context-controls">
        <select
          [(ngModel)]="selectedId"
          (ngModelChange)="onSelectionChange($event)"
          class="context-select">
          <option value="">Todas as bases</option>
          @for (kb of knowledgeBases; track kb.id) {
            <option [value]="kb.id">
              {{ kb.name }} ({{ kb.documentCount }} docs)
            </option>
          }
        </select>

        @if (selectedBase) {
          <div class="context-info">
            <span class="context-desc">{{ selectedBase.description }}</span>
            <span class="context-meta">
              Setor: {{ selectedBase.sector }} &bull;
              Atualizado: {{ selectedBase.lastUpdated | date:'dd/MM/yyyy' }}
            </span>
          </div>
        }
      </div>
    </div>
  `
})
export class ContextSelectorComponent implements OnInit {
  @Input() workspaceId!: string;
  @Output() contextChanged = new EventEmitter<string | null>();

  private http = inject(HttpClient);
  private workspaceCtx = inject(WorkspaceContextService);

  knowledgeBases: KnowledgeBase[] = [];
  selectedId = '';

  get selectedBase(): KnowledgeBase | undefined {
    return this.knowledgeBases.find((kb) => kb.id === this.selectedId);
  }

  ngOnInit(): void {
    const wsId = this.workspaceId || this.workspaceCtx.workspaceId();
    this.http
      .get<KnowledgeBase[]>(`/api/workspaces/${wsId}/knowledge-bases`)
      .subscribe((bases) => (this.knowledgeBases = bases));
  }

  onSelectionChange(id: string): void {
    this.contextChanged.emit(id || null);
  }
}
