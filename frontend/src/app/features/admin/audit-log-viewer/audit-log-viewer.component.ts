import {
  Component, OnInit, inject, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService, AuditEntry } from '../admin.service';
import { KpiCardComponent } from '../shared/kpi-card.component';
import { EmptyStateComponent } from '../shared/empty-state.component';

type SevFilter = '' | 'critical' | 'warning' | 'info';

@Component({
  selector: 'app-audit-log-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, KpiCardComponent, EmptyStateComponent],
  template: `
    <div class="admin-page">
      <div class="breadcrumb">
        <a [routerLink]="['/admin/dashboard']" class="bc-link">Dashboard</a>
        <span class="bc-sep">/</span>
        <span>Log de Auditoria</span>
      </div>

      <div class="admin-header">
        <div>
          <h1>Log de Auditoria</h1>
          <p class="page-sub">Rastreie todas as ações do workspace nos últimos 90 dias</p>
        </div>
        <button class="btn-ghost" (click)="exportCsv()">Exportar CSV</button>
      </div>

      <div class="kpi-row">
        <app-kpi-card [value]="total()" label="Total de eventos" />
        <app-kpi-card
          [value]="critCount()"
          label="Críticos"
          [trend]="critCount() > 0 ? '' + critCount() : undefined"
          [trendDir]="critCount() > 0 ? 'down' : undefined" />
        <app-kpi-card [value]="warnCount()" label="Atenção" />
        <app-kpi-card value="90d" label="Retenção" />
      </div>

      <div class="chip-row">
        @for (chip of sevChips; track chip.value) {
          <button class="chip" [class.chip-active]="activeSev() === chip.value"
                  (click)="setSev(chip.value)">
            @if (chip.dot) { <span class="chip-dot" [style.background]="chip.dot"></span> }
            {{ chip.label }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="event-list">
          @for (i of skeletons; track i) {
            <div class="event-row skeleton">
              <div class="sk-dot"></div>
              <div class="sk-time"></div>
              <div class="sk-avatar"></div>
              <div class="sk-text"></div>
              <div class="sk-ip"></div>
            </div>
          }
        </div>
      } @else if (filtered().length === 0) {
        <app-empty-state
          icon="📋"
          title="Nenhum evento"
          description="Não há eventos de auditoria para o filtro selecionado." />
      } @else {
        <div class="event-list">
          @for (entry of filtered(); track entry.id) {
            <div class="event-row">
              <span class="sev-dot" [class]="'dot-' + entry.severity"></span>
              <span class="ev-time mono">{{ entry.createdAt | date:'dd/MM HH:mm:ss' }}</span>
              <span class="ev-avatar">{{ initials(entry.userName) }}</span>
              <span class="ev-body">
                <span class="ev-action">{{ entry.action }}</span>
                <span class="ev-resource">{{ entry.resourceName }}</span>
              </span>
              <span class="ev-ip mono">{{ entry.userIp ?? '—' }}</span>
            </div>
          }
        </div>

        @if (hasMore()) {
          <button class="load-more" (click)="loadMore()">Carregar mais</button>
        }
      }
    </div>
  `,
  styles: [`
    .admin-page { padding: 28px 32px; max-width: 1200px; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
    .breadcrumb { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-3); margin-bottom:16px; }
    .bc-link { color:var(--ink-2); text-decoration:none; }
    .bc-link:hover { color:var(--ink); }
    .bc-sep { color:var(--line); }
    .admin-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .admin-header h1 { font-size:20px; font-weight:600; color:var(--ink); margin:0 0 4px; }
    .page-sub { font-size:13px; color:var(--ink-3); margin:0; }
    .btn-ghost { background:none; border:1px solid var(--line); border-radius:8px; padding:7px 16px; font-size:13px; color:var(--ink-2); cursor:pointer; }
    .btn-ghost:hover { background:var(--panel-2); }
    .kpi-row { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px; }
    .chip-row { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
    .chip { display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:999px; border:1px solid var(--line); background:var(--white); font-size:12px; font-weight:500; color:var(--ink-2); cursor:pointer; }
    .chip:hover { border-color:var(--acc-line); color:var(--acc); }
    .chip-active { border-color:var(--acc-line); background:var(--acc-soft); color:var(--acc); }
    .chip-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .event-list { border:1px solid var(--line); border-radius:10px; overflow:hidden; margin-bottom:16px; }
    .event-row { display:flex; align-items:center; gap:12px; padding:10px 16px; border-bottom:1px solid var(--line-2); background:var(--white); }
    .event-row:last-child { border-bottom:none; }
    .event-row:hover { background:var(--panel-2); }
    .sev-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .dot-critical { background:var(--acc); }
    .dot-warning  { background:var(--warn); }
    .dot-info     { background:var(--ink-3); }
    .ev-time { font-size:11.5px; color:var(--ink-2); white-space:nowrap; min-width:110px; }
    .ev-avatar { width:26px; height:26px; border-radius:50%; background:var(--acc-soft); color:var(--acc); font-size:10px; font-weight:600; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ev-body { flex:1; display:flex; flex-direction:column; gap:1px; min-width:0; }
    .ev-action { font-size:13px; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ev-resource { font-size:11.5px; color:var(--ink-3); }
    .ev-ip { font-size:11.5px; color:var(--ink-3); min-width:110px; text-align:right; }
    .mono { font-family:'IBM Plex Mono', monospace; }
    .load-more { display:block; width:100%; padding:11px; border:1px solid var(--line); border-radius:8px; background:var(--white); color:var(--ink-2); font-size:13px; cursor:pointer; }
    .load-more:hover { background:var(--panel-2); }
    .skeleton { pointer-events:none; }
    .sk-dot { width:8px; height:8px; border-radius:50%; background:var(--line-2); }
    .sk-time { width:110px; height:12px; border-radius:4px; background:var(--line-2); animation:shimmer 1.4s infinite; }
    .sk-avatar { width:26px; height:26px; border-radius:50%; background:var(--line-2); animation:shimmer 1.4s infinite; }
    .sk-text { flex:1; height:12px; border-radius:4px; background:var(--line-2); animation:shimmer 1.4s infinite; }
    .sk-ip { width:90px; height:12px; border-radius:4px; background:var(--line-2); animation:shimmer 1.4s infinite; }
    @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.4} }
  `],
})
export class AuditLogViewerComponent implements OnInit {
  private adminSvc = inject(AdminService);

  entries   = signal<AuditEntry[]>([]);
  total     = signal(0);
  loading   = signal(true);
  activeSev = signal<SevFilter>('');
  page      = 1;
  readonly perPage = 50;

  skeletons = Array(8).fill(0);

  sevChips: { value: SevFilter; label: string; dot?: string }[] = [
    { value: '',         label: 'Todos' },
    { value: 'critical', label: 'Crítico',  dot: 'var(--acc)' },
    { value: 'warning',  label: 'Atenção',  dot: 'var(--warn)' },
    { value: 'info',     label: 'Info',     dot: 'var(--ink-3)' },
  ];

  critCount = computed(() => this.entries().filter(e => e.severity === 'critical').length);
  warnCount = computed(() => this.entries().filter(e => e.severity === 'warning').length);
  filtered  = computed(() => {
    const sev = this.activeSev();
    return sev ? this.entries().filter(e => e.severity === sev) : this.entries();
  });
  hasMore = computed(() => this.total() > this.entries().length);

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.adminSvc.queryAuditLogs(this.page, this.perPage).subscribe({
      next: (res) => {
        this.entries.set(res.entries);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setSev(sev: SevFilter): void { this.activeSev.set(sev); }

  loadMore(): void {
    this.page++;
    this.adminSvc.queryAuditLogs(this.page, this.perPage).subscribe((res) => {
      this.entries.update((prev) => [...prev, ...res.entries]);
      this.total.set(res.total);
    });
  }

  exportCsv(): void {
    const until = new Date().toISOString();
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    this.adminSvc.exportAuditCsv(since, until).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_${since.slice(0, 10)}_${until.slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  initials(name: string): string {
    return name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  }
}
