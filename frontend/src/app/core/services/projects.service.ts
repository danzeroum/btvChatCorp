import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

export interface ProjectSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);

  readonly projects = signal<ProjectSummary[]>([]);

  /** Busca a lista de projetos do workspace autenticado e atualiza o signal.
   *  Erros de rede/401/403 são tratados pelo authInterceptorFn; aqui apenas
   *  retornamos array vazio para evitar sidebar quebrada. */
  reload(): void {
    this.http
      .get<ProjectSummary[]>('/api/v1/projects')
      .pipe(catchError(() => of([])))
      .subscribe(list => this.projects.set(list));
  }
}
