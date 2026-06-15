/* handoff-data.js — structured implementation spec for the ChatCorp Admin redesign.
   Consumed by "ChatCorp - Admin Handoff.html". Copy is PT-BR to match the team. */
window.HANDOFF = {
  meta: {
    title: 'Admin · ChatCorp',
    subtitle: 'Especificação de implementação — redesenho do painel administrativo',
    repo: 'danzeroum/btvChatCorp · frontend (Angular 17 standalone, SCSS)',
    base: 'Rota base: /admin · guarda: adminGuard · módulo: features/admin',
    fidelity: 'Wireframe hi-fi — cores, tipografia, espaçamento e estados são finais. Recrie com os componentes/estilos do próprio codebase Angular; o HTML é referência visual, não código de produção.',
  },

  // ---------- design tokens ----------
  tokens: {
    color: [
      ['--ink', '#1c1b19', 'Texto principal, botões primários, gráficos'],
      ['--ink-2', '#5f5c57', 'Texto secundário, labels de valor'],
      ['--ink-3', '#9a958d', 'Texto terciário, placeholders, ícones inativos'],
      ['--line', '#e7e4df', 'Bordas de cards, divisores de header'],
      ['--line-2', '#f0eeea', 'Divisores internos de tabela (linhas)'],
      ['--panel', '#fafafa', 'Fundo da sidebar, hover de linha, faixas neutras'],
      ['--panel-2', '#f4f2ee', 'Fundo de avatares, ícones, chips de info'],
      ['--white', '#ffffff', 'Fundo de conteúdo e cards'],
      ['--acc', '#bf5b3d', 'Terracota — ação/seleção, severidade crítica, alertas'],
      ['--acc-soft', '#f8ece6', 'Fundo de alerta/realce terracota'],
      ['--acc-line', '#e7c3b4', 'Borda de elementos terracota'],
      ['--good', '#3f7d62', 'Verde — status saudável/conforme/sucesso'],
      ['--good-soft', '#eaf2ee', 'Fundo de status positivo'],
      ['--warn', '#c08a2e', 'Âmbar — severidade "atenção" (somente texto/dot)'],
    ],
    type: [
      ['Família UI', '"IBM Plex Sans", system-ui, sans-serif', 'Toda a interface'],
      ['Família mono', '"IBM Plex Mono", ui-monospace, monospace', 'Números, IDs, e-mails, chaves, IPs, timestamps, código'],
      ['Título de página', '19–20px / 600 / -0.01em', 'AdminHead'],
      ['Título de seção', '15px / 600', 'SecHead'],
      ['Valor de KPI', '25–26px / 600 / -0.01em', 'Card de métrica'],
      ['Corpo', '12.5–13.5px / 400–560', 'Texto de tabela e cards'],
      ['Label', '11–11.5px / 400 · cor --ink-3', 'Rótulos de campo'],
      ['Cabeçalho de coluna', '10px / 600 / .06em / UPPERCASE · --ink-3', 'Header de tabela'],
    ],
    space: [
      ['Raio — card', '12px'], ['Raio — botão', '9px'], ['Raio — chip/pill', '7px / 999px'],
      ['Padding card', '15–18px'], ['Padding página', '20px 28px'], ['Gap entre cards', '12px'],
      ['Largura de conteúdo', 'máx. 1000–1120px, centralizado'], ['Sidebar', '232px fixa'],
      ['Drawer (detalhe)', '440px, overlay à direita, scrim rgba(28,27,25,.28)'],
      ['Altura mín. de toque', '36–44px'],
    ],
  },

  // ---------- route map ----------
  routes: [
    ['Visão geral', '/admin/dashboard', 'AdminDashboardComponent', 'overview/admin-dashboard.component.ts', 'existe — refatorar'],
    ['Usuários & papéis', '/admin/users', 'UserManagementComponent', 'user-management/user-management.component.ts', 'existe — refatorar'],
    ['↳ Detalhe do usuário', '/admin/users (drawer)', 'UserDetailDrawerComponent', 'user-management/user-detail-drawer.component.ts', 'novo (filho)'],
    ['SSO & acesso', '/admin/sso', 'SsoConfigComponent', 'sso-config/sso-config.component.ts', 'existe — refatorar'],
    ['Modelos & LoRA', '/admin/ai-config', 'ModelManagerComponent', 'ai-config/model-manager.component.ts', 'existe — refatorar'],
    ['Auditoria', '/admin/audit', 'AuditLogViewerComponent', 'audit-log-viewer/audit-log-viewer.component.ts', 'existe — refatorar'],
    ['Compliance LGPD', '/admin/compliance', 'ComplianceLgpdComponent', 'compliance/compliance-lgpd.component.ts', 'NOVA rota'],
    ['Retenção de dados', '/admin/settings/retention', 'DataRetentionComponent', 'workspace-settings/data-retention.component.ts', 'NOVA (sub de settings)'],
    ['Uso & custos', '/admin/billing', 'UsageOverviewComponent', 'billing/usage-overview.component.ts', 'existe — refatorar'],
    ['API keys', '/admin/api-keys', 'ApiKeysComponent', 'api-keys/api-keys.component.ts', 'existe — refatorar'],
    ['Webhooks', '/admin/integrations/webhooks', 'WebhooksConfigComponent', 'integrations/webhooks-config.component.ts', 'existe — refatorar'],
    ['White-label', '/admin/branding', 'BrandingAdminPageComponent', 'white-label/branding-admin-page.component.ts', 'existe — refatorar'],
  ],

  // ---------- shared components ----------
  shared: [
    ['AdminLayoutComponent', 'Shell: sidebar 232px + <router-outlet>. Agrupa navegação por área (Gestão, IA·MLOps, Governança, FinOps, Integrações, Marca). Item ativo via routerLinkActive.'],
    ['AdminHeaderComponent', '@Input title, subtitle; <ng-content> para ações à direita. Borda inferior --line, padding 20px 28px 16px.'],
    ['KpiCardComponent', '@Input value, label, trend?, trendDir? ("up"|"down"|"warn"). Usar em grid repeat(N,1fr) gap 12px.'],
    ['StatusPillComponent', '@Input kind ("ok"|"warn"|"bad"|"neutral"), texto via content. Mapeia para good/acc/neutro.'],
    ['DataTableComponent', 'Grid CSS por colunas (não <table>). Header uppercase 10px; linhas com border-top --line-2; hover --panel.'],
    ['GaugeComponent', '@Input value(0–100), sub, color. SVG donut r=46 stroke 11.'],
    ['MiniBarComponent', '@Input value, max, color, height. Barra de progresso fina (trilho --line-2).'],
    ['ToggleComponent', 'Switch 34×20, ControlValueAccessor (usar com Reactive Forms).'],
    ['EmptyStateComponent', 'Ícone + título + descrição + ação. Para tabelas sem resultado.'],
  ],

  conventions: [
    'Estado: usar Angular Signals (signal/computed) nos componentes; dados via services com HttpClient e tipos compartilhados em core/models.',
    'Tabelas são grids CSS (display:grid; grid-template-columns) — NÃO usar <table>. Garante alinhamento idêntico ao mock.',
    'Números, IDs, e-mails, chaves, IPs e timestamps sempre em IBM Plex Mono.',
    'Toda ação destrutiva (suspender, revogar, excluir, alterar retenção) abre confirmação e gera evento de auditoria.',
    'Datas em pt-BR (DatePipe locale pt). Moeda em BRL (CurrencyPipe). Sem bibliotecas de UI novas — seguir o design system do repo.',
    'Acessibilidade: foco visível (--acc ring), aria-label em ícones-botão, alvo mín. 36px, contraste AA.',
  ],

  // ---------- per-screen specs ----------
  screens: [
    {
      n: '01', id: 'overview', img: 'screens/01-screen.png',
      title: 'Visão geral', tag: 'Centro de operações',
      route: '/admin/dashboard', comp: 'AdminDashboardComponent', file: 'overview/admin-dashboard.component.ts', status: 'Refatorar (hoje é card de saúde + grade de atalhos com emoji)',
      purpose: 'Primeira tela do admin. Responde em 5s: o sistema está de pé? o que exige minha ação? quanto estamos usando/gastando? Para onde ir?',
      layout: [
        'Coluna única, máx-largura 1120px centralizada, padding 20px 28px 40px, scroll vertical no corpo.',
        '1) Faixa de saúde — card full-width, flex, pill verde "Sistema operacional" + 5 dots de serviço + uptime/latência em mono à direita.',
        '2) "Precisa da sua atenção" — SecHead com contador + grade 2 colunas de cards de ação (o destaque do redesenho).',
        '3) Métricas — grid 3 colunas (1.6fr / 0.85fr / 1fr): KPIs 2×2 · Gauge GPU · Composição de custo.',
        '4) "Áreas de administração" — grid 3 colunas de cards de navegação (ícone + título + 1 stat + chevron).',
      ],
      components: [
        ['Faixa de saúde', 'Card pad 14/18px. Dot 8px: --good (ok) / --acc (down). Texto serviço 12.5px --ink-2. Métricas em mono 11.5px --ink-3.'],
        ['Card de ação', 'Borda/fundo por severidade: critical→--acc-line/--acc-soft, warning→#ecd9b0/#faf3e6, info→--line/--panel. Ícone 30px em quadro branco. Título 13.5px/600 na cor da severidade. CTA: crítico=botão --acc, demais=ghost.'],
        ['KPI', 'KpiCardComponent. Valor 25px/600, trend mono 11px (--good se up, --acc se warn).'],
        ['Gauge GPU', 'GaugeComponent value=73 cor --acc + linha VRAM (MiniBar).'],
        ['Card de navegação', 'Ícone 38px em quadro --panel-2, título 13.5px/600, stat 11.5px --ink-3, chevron --ink-3. Hover: sombra + borda --ink-3. routerLink para a área.'],
      ],
      model: `interface AdminOverview {
  health: { status: 'operational'|'degraded'|'down';
            services: { name: string; up: boolean }[];
            uptimePct: number; latencyMs: number };
  pendingActions: PendingAction[];   // ordenadas por severidade
  kpis: { activeUsers: number; conversations30d: number;
          tokens30d: number; costPerUserMonth: number };
  gpu: { utilPct: number; vramUsedGb: number; vramTotalGb: number; model: string };
  cost30d: { totalBrl: number;
             breakdown: { label: string; valueBrl: number; pct: number }[] };
}
interface PendingAction {
  id: string; severity: 'critical'|'warning'|'info';
  icon: string; title: string; description: string;
  cta: { label: string; route: string; queryParams?: Record<string,string> };
}`,
      api: [
        'GET /api/admin/overview → AdminOverview (agrega os blocos; cachear 60s)',
        'GET /api/admin/health → bloco health (poll 30s, independente)',
        'Cada ação navega via router para sua rota+queryParams (ex.: /admin/users?filter=no-mfa)',
      ],
      states: [
        'Loading: skeleton por bloco (não bloquear a tela inteira).',
        'Saúde degradada: pill vira --acc "Atenção em N serviços"; dots afetados em --acc.',
        'Sem ações pendentes: card único verde "Tudo em dia — nenhuma ação pendente".',
        'Erro de fetch: banner de retry no topo, mantém último valor conhecido.',
      ],
      interactions: ['CTA de ação → router.navigate(route, {queryParams}).', 'Card de área → routerLink.', 'Filtro de período (30d) e Exportar no header.'],
    },

    {
      n: '02', id: 'users', img: 'screens/02-screen.png',
      title: 'Usuários & papéis', tag: 'Tabela + ações em massa',
      route: '/admin/users', comp: 'UserManagementComponent', file: 'user-management/user-management.component.ts', status: 'Refatorar',
      purpose: 'Gerir membros do workspace: papéis, MFA, convites e suspensões. Triagem rápida por filtros e ações em lote.',
      layout: [
        'Máx-largura 1080px. Breadcrumb "← Visão geral" no topo.',
        '1) Breadcrumb. 2) KPIs 4 colunas. 3) Chips de filtro (Todos/Admin/Curador/Membro/Pendentes/Sem MFA·N/Suspensos). 4) Barra de ação em massa (aparece com seleção). 5) Tabela.',
        'Tabela grid: 34px(check) 1.7fr(usuário) 110px(papel) 96px(status) 60px(MFA) 116px(último acesso) 40px(chevron).',
      ],
      components: [
        ['Chip de filtro', 'Ativo: fundo --ink, texto branco. "Sem MFA" mostra contador --acc. Clique troca filtro e limpa seleção.'],
        ['Barra em massa', 'Visível quando selecionados>0. Card --acc-soft: "N selecionado(s)" + ações (Mudar papel / Exigir MFA / Suspender).'],
        ['Linha', 'Avatar iniciais 28px + nome 600 + e-mail mono 10.5px. Papel=chip (Admin destacado terracota). Status=StatusPill. MFA=✓ verde ou ✕ --acc. Clique na linha abre drawer; clique no check seleciona (stopPropagation).'],
        ['Checkbox', 'Box 16px, marcado=fundo --ink + check branco. Header seleciona/deseleciona a página filtrada.'],
      ],
      model: `interface WorkspaceUser {
  id: string; name: string; email: string;
  role: 'Admin'|'Curador'|'Membro';
  status: 'active'|'pending'|'suspended';
  mfaEnabled: boolean; lastAccessAt: string|null;
  joinedAt: string; team: string;
  messages30d: number; activeSessions: number;
}
type UserFilter = 'all'|'Admin'|'Curador'|'Membro'|'pending'|'no-mfa'|'suspended';`,
      api: [
        'GET /api/admin/users?filter=&search=&page= → { items: WorkspaceUser[]; total; counts }',
        'POST /api/admin/users/invite { email, role }',
        'PATCH /api/admin/users/:id { role?, status? }',
        'POST /api/admin/users/bulk { ids:[], action:"role"|"require-mfa"|"suspend", payload }',
      ],
      states: [
        'Filtro sem resultado → EmptyState "Nenhum usuário neste filtro".',
        'Aceita ?filter= na query (deep-link vindo da Visão geral, ex. no-mfa, pending).',
        'Linha pendente: status "Pendente", último acesso "—".',
        'Loading: skeleton de 6 linhas.',
      ],
      interactions: ['Linha → abre UserDetailDrawer.', 'Seleção → barra em massa.', 'Convidar (header) → modal/drawer de convite.', 'Buscar (header) → filtra por nome/e-mail.'],
    },

    {
      n: '03', id: 'user-drawer', img: 'screens/03-screen.png',
      title: 'Detalhe do usuário', tag: 'Drawer (subtela)',
      route: '/admin/users (overlay)', comp: 'UserDetailDrawerComponent', file: 'user-management/user-detail-drawer.component.ts', status: 'Novo — componente filho',
      purpose: 'Inspecionar e editar um usuário sem sair da lista: papel, MFA, metadados e atividade recente.',
      layout: [
        'Overlay 440px à direita sobre scrim rgba(28,27,25,.28). Coluna flex: header / corpo com scroll / rodapé fixo.',
        'Header: avatar 44px, nome 16px, e-mail mono, status pill + chip de time, botão ✕.',
        'Corpo: alerta MFA (se faltar) → seletor de Papel (3 chips + texto da permissão) → grid 2×2 de Detalhes → lista de Atividade recente.',
        'Rodapé: "Salvar alterações" (primário, flex:1) + "Suspender/Reativar" (ghost terracota).',
      ],
      components: [
        ['Alerta MFA', 'Só quando !mfaEnabled && status=active. Card --acc-soft + botão "Exigir agora".'],
        ['Seletor de papel', '3 chips full-width; selecionado=--ink. Abaixo, descrição da permissão por papel.'],
        ['Grid de detalhes', 'Entrou · Último acesso · Mensagens 30d · Sessões ativas. Label 11px --ink-3, valor 13.5px/600.'],
        ['Atividade', 'Lista com dot --ink-3, descrição --ink-2, timestamp mono à direita.'],
      ],
      model: `// usa WorkspaceUser + histórico:
interface UserActivity { id: string; label: string; at: string; }
// GET /api/admin/users/:id/activity → UserActivity[]`,
      api: [
        'GET /api/admin/users/:id → WorkspaceUser (detalhe)',
        'GET /api/admin/users/:id/activity → UserActivity[]',
        'PATCH /api/admin/users/:id { role, status }',
        'POST /api/admin/users/:id/require-mfa',
      ],
      states: ['MFA ok: alerta some.', 'status=suspended: botão vira "Reativar".', 'Mudança de papel não salva até "Salvar alterações" (form dirty).', 'Esc / clique no scrim / ✕ fecham o drawer.'],
      interactions: ['Trap de foco no drawer; restaurar foco ao fechar.', 'Animação slide-in 160ms ease-out.', 'Salvar → PATCH + toast + atualiza linha na lista.'],
    },

    {
      n: '04', id: 'sso', img: 'screens/04-screen.png',
      title: 'SSO & acesso', tag: 'Provedores + política de sessão',
      route: '/admin/sso', comp: 'SsoConfigComponent', file: 'sso-config/sso-config.component.ts', status: 'Refatorar',
      purpose: 'Configurar login único (Google, Microsoft, Okta, SAML), domínios permitidos e políticas de sessão/segurança.',
      layout: ['Máx 940px. KPIs 4col → "Provedores de identidade" (grid 2col) → "Domínios permitidos" (chips) → "Política de sessão" (lista com toggles).'],
      components: [
        ['Card de provedor', 'Marca 40px (--ink se ativo) + nome + "N usuários conectados"/"Não configurado" + Toggle. Toggle on abre fluxo de config.'],
        ['Domínios', 'Chips com "✓ verificado" (--good) + chip tracejado "+ Adicionar domínio".'],
        ['Política', 'Lista de regras: título 13px/560 + descrição 11.5px --ink-3 + Toggle. Exigir MFA, timeout, faixa de IP, reautenticação em ações críticas.'],
      ],
      model: `interface SsoConfig {
  providers: { id:'google'|'microsoft'|'okta'|'saml';
               name:string; enabled:boolean; connectedUsers:number }[];
  domains: { domain:string; verified:boolean }[];
  sessionPolicy: { requireMfa:boolean; timeoutHours:number;
                   ipAllowlistEnabled:boolean; reauthOnCritical:boolean };
}`,
      api: ['GET /api/admin/sso → SsoConfig', 'PUT /api/admin/sso/providers/:id { enabled, ...oauthConfig }', 'POST /api/admin/sso/domains { domain } · DELETE …/:domain', 'PUT /api/admin/sso/session-policy { … }'],
      states: ['Provedor ativando: estado "Conectando…" durante OAuth handshake.', 'Domínio não verificado: chip âmbar + instrução DNS TXT.', 'Salvar habilitado só com form dirty.'],
      interactions: ['Toggle de provedor → modal OAuth/SAML.', 'Toggles de política via Reactive Form.', 'Salvar persiste tudo.'],
    },

    {
      n: '05', id: 'models', img: 'screens/05-screen.png',
      title: 'Modelos & LoRA', tag: 'MLOps',
      route: '/admin/ai-config', comp: 'ModelManagerComponent', file: 'ai-config/model-manager.component.ts', status: 'Refatorar',
      purpose: 'Operar a inferência self-hosted (vLLM): modelo em produção, métricas de GPU e gestão de adapters LoRA com hot-swap.',
      layout: ['Máx 1080px. Breadcrumb → KPIs 4col → "Modelo em produção" (card com specs + gauge) → "Adapters LoRA" (tabela com promoção).', 'Tabela: 1.1fr(versão) 1.3fr(tarefa) 90px(acurácia) 96px(vs ativo) 80px(tamanho) 70px(status) 120px(ação).'],
      components: [
        ['Card de produção', 'Ícone 52px + nome + StatusPill "Online" + chip da versão LoRA. Specs: quantização, contexto, latência p50, réplicas. Gauge GPU à direita.'],
        ['Linha de adapter', 'Versão em mono/600, tarefa + base, acurácia, delta vs ativo (--good se +), tamanho, status (Ativo/Em teste/Arquivado).'],
        ['Ação por status', 'staged→"Promover" (--acc), archived→"Restaurar" (chip), active→texto "Em produção".'],
      ],
      model: `interface ActiveModel {
  baseModel:string; quantization:string; contextTokens:number;
  latencyP50Ms:number; replicas:[number,number];
  throughputTokS:number; gpuUtilPct:number; gpu:string;
  activeAdapterVersion:string;
}
interface LoraAdapter {
  version:string; baseModel:string; task:string;
  accuracy:number; deltaVsActive:string; sizeMb:number;
  createdAt:string; status:'active'|'staged'|'archived';
}`,
      api: ['GET /api/admin/ai/model → ActiveModel', 'GET /api/admin/ai/adapters → LoraAdapter[]', 'POST /api/admin/ai/adapters/:version/promote (hot-swap)', 'POST /api/admin/ai/adapters (upload) · POST …/:version/archive'],
      states: ['Promover: confirmação + estado "Promovendo… (hot-swap)" sem downtime, depois swap de status.', 'GPU>90%: gauge --acc + aviso.', 'Upload: barra de progresso.'],
      interactions: ['Promover/Restaurar/Arquivar adapter.', 'Subir adapter (header) → modal de upload.', 'Recarregar métricas.'],
    },

    {
      n: '06', id: 'audit', img: 'screens/06-screen.png',
      title: 'Auditoria', tag: 'Trilha de eventos',
      route: '/admin/audit', comp: 'AuditLogViewerComponent', file: 'audit-log-viewer/audit-log-viewer.component.ts', status: 'Refatorar',
      purpose: 'Trilha imutável de eventos (login, exports, mudanças de config, suspensões) para segurança e conformidade.',
      layout: ['Máx 1000px. Breadcrumb → KPIs 4col → filtros de severidade + contador → lista de eventos.', 'Linha: dot de severidade + horário/dia (mono) + avatar do ator + ação/descrição + IP (mono à direita).'],
      components: [
        ['Filtro de severidade', 'Chips Todos/Crítico/Atenção/Info. Ativo=--ink.'],
        ['Evento', 'Dot: info→--ink-3, warning→#c08a2e, critical→--acc. Ação 13px/560, "ator · meta" 11.5px --ink-3, IP mono 11px.'],
      ],
      model: `interface AuditEvent {
  id:string; at:string; severity:'info'|'warning'|'critical';
  actor:{ id:string; name:string }; action:string;
  target?:string; ip:string; meta:string;
}`,
      api: ['GET /api/admin/audit?severity=&actor=&action=&from=&to=&page= → { items:AuditEvent[]; total }', 'GET /api/admin/audit/export?format=csv (stream)'],
      states: ['Filtro vazio → EmptyState.', 'Imutável: sem editar/excluir, apenas leitura + export.', 'Paginação infinita ou "carregar mais".'],
      interactions: ['Filtrar por severidade (e idealmente ator/ação/período).', 'Exportar log (CSV).', 'Período no header (7d default).'],
    },

    {
      n: '07', id: 'compliance', img: 'screens/07-screen.png',
      title: 'Compliance LGPD', tag: 'Governança · NOVA rota',
      route: '/admin/compliance', comp: 'ComplianceLgpdComponent', file: 'compliance/compliance-lgpd.component.ts', status: 'NOVA — adicionar rota em admin.routes.ts',
      purpose: 'Painel de conformidade LGPD: score, checklist de controles e fila de solicitações de titulares (DSAR).',
      layout: ['Máx 1000px. Grid 300px/1fr: card de Score (gauge 150px) + lista de controles. Abaixo: tabela DSAR.', 'DSAR grid: 1fr(titular) 130px(tipo) 120px(prazo) 130px(status).'],
      components: [
        ['Card de score', 'GaugeComponent value=92 cor --good + "Score de conformidade" + "N itens precisam de atenção".'],
        ['Linha de controle', 'Selo 22px: ok→--good "✓", partial→--warn "!", pending→--acc "○". Nome 13px/560 + nota. Botão "Resolver" se ≠ ok.'],
        ['Linha DSAR', 'Titular (mono), tipo (Exclusão/Exportação), prazo (--acc se pendente), StatusPill (Pendente/Em andamento/Concluído).'],
      ],
      model: `interface ComplianceState {
  scorePct:number;
  controls:{ id:string; name:string;
             status:'ok'|'partial'|'pending'; note:string }[];
  dsar:{ id:string; subjectRef:string;
         type:'deletion'|'export'; dueAt:string;
         status:'pending'|'progress'|'done' }[];
}`,
      api: ['GET /api/admin/compliance → ComplianceState', 'POST /api/admin/compliance/dsar/:id/resolve', 'GET /api/admin/compliance/report.pdf'],
      states: ['Score calculado a partir dos controles (peso por item).', 'DSAR fora do prazo (15 dias): prazo em --acc + destaque.', 'Sem DSAR pendente: EmptyState.'],
      interactions: ['"Resolver" leva ao controle (ex.: MFA → Usuários?filter=no-mfa).', 'Exportar relatório PDF.', 'Concluir DSAR (com confirmação + auditoria).'],
    },

    {
      n: '08', id: 'retention', img: 'screens/08-screen.png',
      title: 'Retenção de dados', tag: 'Settings · NOVA',
      route: '/admin/settings/retention', comp: 'DataRetentionComponent', file: 'workspace-settings/data-retention.component.ts', status: 'NOVA — sub-aba de WorkspaceSettings',
      purpose: 'Definir ciclo de vida e exclusão automática por tipo de dado (conversas, logs, anexos, embeddings).',
      layout: ['Máx 920px. Aviso no topo → lista de cards de política (um por tipo de dado).', 'Card: ícone + tipo + uso (GB) + Toggle "Exclusão automática"; abaixo, chips de período (Manter/30/90/180/365 dias).'],
      components: [
        ['Aviso', 'Card --panel: exclusão irreversível + auditada; logs têm mínimo legal 365d.'],
        ['Card de política', 'Ícone 38px + tipo 13.5px/600 + "N GB armazenados". Toggle de auto-exclusão. Chips de período; selecionado=--ink. Logs: 365d travado (mínimo legal).'],
      ],
      model: `interface RetentionPolicy {
  dataType:'conversations'|'audit-logs'|'attachments'|'embeddings';
  label:string; retentionDays:number; // 0 = manter para sempre
  autoDelete:boolean; storageGb:number; locked:boolean;
}`,
      api: ['GET /api/admin/retention → RetentionPolicy[]', 'PUT /api/admin/retention { policies:RetentionPolicy[] }'],
      states: ['Política travada (logs): chips desabilitados em 365d.', 'Reduzir retenção: confirmação alertando exclusão futura.', 'Salvar só com alterações.'],
      interactions: ['Selecionar período por chip.', 'Toggle de auto-exclusão.', 'Salvar políticas (audita).'],
    },

    {
      n: '09', id: 'usage', img: 'screens/09-screen.png',
      title: 'Uso & custos', tag: 'FinOps',
      route: '/admin/billing', comp: 'UsageOverviewComponent', file: 'billing/usage-overview.component.ts', status: 'Refatorar',
      purpose: 'Acompanhar consumo e custo estimado de infraestrutura: orçamento, tendência e rateio por projeto.',
      layout: ['Máx 1040px. KPIs 4col → alerta de orçamento → grid 1.5fr/1fr (gráfico semanal + composição) → tabela "Custo por projeto".', 'Tabela: 1.4fr(projeto) 1fr(tokens) 110px(custo) 1fr(participação) 80px(mês).'],
      components: [
        ['Alerta de orçamento', 'Card --acc-soft: "% do orçamento utilizado" + projeção + "Ajustar limite". Aparece acima de 80%.'],
        ['Gráfico de barras', 'BarChartComponent (custo/semana), última barra em --acc.'],
        ['Composição', 'GPU / Storage / Rede com MiniBar e valor BRL (mono).'],
        ['Linha de projeto', 'Tokens (mono), custo (mono/600), participação (MiniBar+%), variação mês (--acc se +, --good se −).'],
      ],
      model: `interface UsageOverview {
  period:string;
  kpis:{ cost30dBrl:number; costPerUserBrl:number;
         tokens30d:number; gpuHours:number };
  budget:{ limitBrl:number; usedBrl:number; projectedBrl:number };
  weekly:{ label:string; valueBrl:number }[];
  breakdown:{ label:string; valueBrl:number; pct:number }[];
  byProject:{ name:string; tokens:number; costBrl:number;
              pct:number; momChange:string }[];
}`,
      api: ['GET /api/admin/billing?period= → UsageOverview', 'PUT /api/admin/billing/budget { limitBrl }', 'GET /api/admin/billing/export?format=csv'],
      states: ['<80% orçamento: alerta oculto. ≥100%: alerta crítico.', 'Loading: skeleton de gráfico/tabela.', 'Trocar período recarrega tudo.'],
      interactions: ['Ajustar limite de orçamento.', 'Exportar CSV.', 'Seletor de mês no header.'],
    },

    {
      n: '10', id: 'keys', img: 'screens/10-screen.png',
      title: 'API keys', tag: 'Integrações',
      route: '/admin/api-keys', comp: 'ApiKeysComponent', file: 'api-keys/api-keys.component.ts', status: 'Refatorar',
      purpose: 'Gerir chaves de acesso programático: criar, ver escopo/uso/expiração e revogar.',
      layout: ['Máx 1000px. KPIs 4col → (banner de chave recém-criada) → tabela de chaves.', 'Tabela: 1.3fr(nome) 1.2fr(chave) 100px(escopo) 110px(último uso) 120px(status) 60px(ação).'],
      components: [
        ['Banner de criação', 'Aparece após criar: card --good-soft, chave completa em mono + "Copiar" + aviso "não será exibida novamente".'],
        ['Linha de chave', 'Nome/600 + "criada DATA". Prefixo mascarado (sk_live_…) em mono. Escopo=chip. Último uso mono. StatusPill (Ativa/Expira em breve/Revogada). "Revogar" --acc.'],
      ],
      model: `interface ApiKey {
  id:string; name:string; prefix:string; // mascarado
  scope:'read-only'|'read-write'; createdAt:string;
  lastUsed:string|null; expiresAt:string|null;
  status:'active'|'expiring'|'revoked';
}`,
      api: ['GET /api/admin/api-keys → ApiKey[]', 'POST /api/admin/api-keys { name, scope, expiresAt } → { …key, secret } (secret só nesta resposta)', 'DELETE /api/admin/api-keys/:id (revoga)'],
      states: ['Revogada: linha esmaecida (opacity .55), sem ação.', 'Expiring (≤14d): StatusPill âmbar.', 'Secret exibido UMA vez no banner.'],
      interactions: ['Nova chave (header) → cria e mostra banner.', 'Copiar secret.', 'Revogar (confirmação + auditoria).'],
    },

    {
      n: '11', id: 'webhooks', img: 'screens/11-screen.png',
      title: 'Webhooks', tag: 'Integrações',
      route: '/admin/integrations/webhooks', comp: 'WebhooksConfigComponent', file: 'integrations/webhooks-config.component.ts', status: 'Refatorar (+ webhook-logs.component p/ subrota)',
      purpose: 'Notificações HTTP de eventos para sistemas externos: endpoints, status e log de entregas com reenvio.',
      layout: ['Máx 1000px. KPIs 4col → tabela "Endpoints" → seção "Entregas recentes" (log).', 'Endpoints grid: 1.8fr(url) 1.3fr(eventos) 90px(status) 150px(última entrega) 90px(sucesso).'],
      components: [
        ['Linha de endpoint', 'URL mono truncada + chip de eventos (mono) + StatusPill (Ativo/Falhando) + última entrega (código·tempo, --acc se erro) + taxa de sucesso mono.'],
        ['Entrega', 'Dot ok/erro + evento (mono) + código HTTP (--good/--acc) + timestamp mono.'],
      ],
      model: `interface WebhookEndpoint {
  id:string; url:string; events:string[];
  status:'active'|'failing'; lastDelivery:{ code:number; at:string };
  successRate:number;
}
interface WebhookDelivery {
  id:string; endpointId:string; event:string;
  code:number; at:string; ok:boolean;
}`,
      api: ['GET /api/admin/webhooks → WebhookEndpoint[]', 'POST /api/admin/webhooks { url, events }', 'GET /api/admin/webhooks/:id/logs → WebhookDelivery[] (rota /:webhookId/logs já existe)', 'POST /api/admin/webhooks/:id/redeliver { deliveryIds? }'],
      states: ['Endpoint falhando: StatusPill --acc + última entrega em vermelho.', 'Reenviar falhas em lote.', 'Endpoint novo → modal com seleção de eventos + secret de assinatura.'],
      interactions: ['Novo endpoint.', 'Reenviar falhas.', 'Linha → /:id/logs (componente WebhookLogs).'],
    },

    {
      n: '12', id: 'branding', img: 'screens/12-screen.png',
      title: 'White-label', tag: 'Marca',
      route: '/admin/branding', comp: 'BrandingAdminPageComponent', file: 'white-label/branding-admin-page.component.ts', status: 'Refatorar',
      purpose: 'Personalizar a marca do workspace (logo, cor, domínio, remetente) com pré-visualização ao vivo do chat.',
      layout: ['Máx 940px. Grid 1fr/360px: coluna de edição (Identidade visual / Domínio / E-mail) + coluna de Pré-visualização sticky.'],
      components: [
        ['Upload de logo', 'Dois slots (claro/escuro) — usar FileUpload do design system (drag&drop SVG/PNG).'],
        ['Cor primária', 'Paleta de 6 swatches 30px; selecionado com ring --ink. Aplica na preview em tempo real.'],
        ['Domínio', 'Campo mono + StatusPill "✓ SSL ativo".'],
        ['Preview', 'Mini-chat: header com logo+cor, bolha do usuário na cor primária, input com botão enviar na cor. Atualiza ao trocar a cor.'],
      ],
      model: `interface BrandingConfig {
  logoLightUrl:string|null; logoDarkUrl:string|null;
  primaryColor:string;        // hex
  customDomain:{ host:string; sslActive:boolean };
  emailSender:{ name:string; address:string };
}`,
      api: ['GET /api/admin/branding → BrandingConfig', 'PUT /api/admin/branding { …config }', 'POST /api/admin/branding/logo (multipart) → url', 'POST /api/admin/branding/domain/verify'],
      states: ['Cor altera a preview instantaneamente (signal computed).', 'Domínio sem SSL: pill âmbar + status de provisionamento.', 'Publicar persiste; preview reflete antes de publicar.'],
      interactions: ['Selecionar cor → preview ao vivo.', 'Upload de logo.', 'Publicar.'],
    },
  ],
};
