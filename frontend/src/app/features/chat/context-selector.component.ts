import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContext } from '../../core/services/workspace-context.service';

export interface Project {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  icon: string;
}

@Component({
  selector: 'app-context-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="context-selector">
      <label>Base de conhecimento:</label>
      <select [(ngModel)]="selectedProjectId" (ngModelChange)="onProjectChange($event)">
        @for (project of projects; track project.id) {
          <option [value]="project.id">
            {{ project.icon }} {{ project.name }} ({{ project.documentCount }} docs)
          </option>
        }
      </select>
    </div>
  `
})
export class ContextSelectorComponent implements OnInit {
  @Input() workspace!: WorkspaceContext;
  @Output() contextChanged = new EventEmitter<Project>();

  private http = inject(HttpClient);

  projects: Project[] = [];
  selectedProjectId = '';

  ngOnInit(): void {
    this.http.get<Project[]>('/api/projects').subscribe(projects => {
      this.projects = projects;
      if (projects.length > 0) {
        this.selectedProjectId = this.workspace.activeProjectId ?? projects[0].id;
      }
    });
  }

  onProjectChange(projectId: string): void {
    const project = this.projects.find(p => p.id === projectId);
    if (project) this.contextChanged.emit(project);
  }
}
