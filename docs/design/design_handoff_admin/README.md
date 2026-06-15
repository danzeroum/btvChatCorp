# Handoff: Painel Administrativo — ChatCorp

Especificação de implementação do redesenho do **admin** (`/admin`) do ChatCorp.

## Visão geral
O painel admin atual (`https://chatcorp.buildtovalue.cloud/admin/`) é um card de saúde + uma
grade de atalhos com emoji que se deforma e não oferece hierarquia de informação. Este pacote
redesenha **as 12 telas/estados** do admin com um sistema visual consistente (IBM Plex +
terracota), foco em "centro de operações" na home e profundidade real nas subtelas.

## Sobre os arquivos deste pacote
Os arquivos HTML/JSX aqui são **referências de design criadas em HTML** — protótipos que mostram
aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é
**recriar estes designs no codebase Angular existente** (`danzeroum/btvChatCorp · frontend`),
usando seus padrões, componentes standalone e SCSS. Não introduza novas bibliotecas de UI.

## Fidelidade
**Hi-fi.** Cores, tipografia, espaçamento e estados são finais — veja os tokens na spec. Recrie a
UI com fidelidade usando os componentes/estilos do próprio repo.

## O que abrir primeiro
1. **`ChatCorp - Admin Handoff.html`** — a spec completa e anotada (abra no navegador).
   Capa + fundamentos (tokens, mapa de rotas, componentes compartilhados, convenções) e, por tela:
   screenshot, propósito, rota/componente/arquivo Angular, layout, componentes & estilo,
   **modelo de dados (interfaces TS)**, **contrato de API proposto** e estados/interações.
2. **`prototype/ChatCorp - Admin Proposta.html`** — o protótipo clicável (navegue pela sidebar;
   clique numa linha de usuário para abrir o drawer). Serve como referência de comportamento.
3. **`screens/`** — PNGs de cada tela/estado.

## Mapa de rotas → componentes (já existentes no repo)
A maioria das rotas **já existe** em `features/admin/admin.routes.ts` — o trabalho é refatorar a UI.
Duas telas são **novas** (Compliance LGPD e Retenção de dados).

| Tela | Rota | Componente | Status |
|---|---|---|---|
| Visão geral | `/admin/dashboard` | `AdminDashboardComponent` | refatorar |
| Usuários & papéis | `/admin/users` | `UserManagementComponent` | refatorar |
| ↳ Detalhe do usuário | `/admin/users` (drawer) | `UserDetailDrawerComponent` | novo (filho) |
| SSO & acesso | `/admin/sso` | `SsoConfigComponent` | refatorar |
| Modelos & LoRA | `/admin/ai-config` | `ModelManagerComponent` | refatorar |
| Auditoria | `/admin/audit` | `AuditLogViewerComponent` | refatorar |
| Compliance LGPD | `/admin/compliance` | `ComplianceLgpdComponent` | **nova rota** |
| Retenção de dados | `/admin/settings/retention` | `DataRetentionComponent` | **nova** |
| Uso & custos | `/admin/billing` | `UsageOverviewComponent` | refatorar |
| API keys | `/admin/api-keys` | `ApiKeysComponent` | refatorar |
| Webhooks | `/admin/integrations/webhooks` | `WebhooksConfigComponent` | refatorar |
| White-label | `/admin/branding` | `BrandingAdminPageComponent` | refatorar |

## Design tokens (resumo — completo na spec)
- **Cores:** ink `#1c1b19` · ink-2 `#5f5c57` · ink-3 `#9a958d` · line `#e7e4df` · panel `#fafafa`
  · **acento (terracota)** `#bf5b3d` (+ soft `#f8ece6`, line `#e7c3b4`) · **good** `#3f7d62` · warn `#c08a2e`.
- **Tipo:** UI = IBM Plex Sans; números/IDs/e-mails/chaves/IPs/timestamps/código = **IBM Plex Mono**.
- **Forma:** card raio 12px · botão 9px · chip 7px · padding página 20×28px · conteúdo máx 1000–1120px
  · sidebar 232px · drawer 440px.

## Convenções
- Estado com **Angular Signals**; dados via services + `HttpClient` e tipos em `core/models`.
- **Tabelas são grids CSS** (`display:grid; grid-template-columns`) — não `<table>`.
- Toda ação destrutiva → confirmação + evento de auditoria.
- Datas pt-BR (`DatePipe`), moeda BRL (`CurrencyPipe`). Acessibilidade AA, foco visível, alvo ≥36px.
- Os endpoints da spec são **contratos propostos** — alinhe com o backend antes de implementar.

## Arquivos do pacote
```
design_handoff_admin/
├── README.md                          ← este arquivo
├── ChatCorp - Admin Handoff.html      ← SPEC anotada (abrir primeiro)
├── handoff-data.js                    ← dados da spec (todas as telas)
├── screens/                           ← 12 PNGs (01..12)
└── prototype/                         ← protótipo clicável + fontes JSX
    ├── ChatCorp - Admin Proposta.html
    ├── wf-kit.jsx · wf-admin-kit.jsx
    └── admin-proposal*.jsx
```
