// admin-proposal.jsx — interactive shell + redesigned Overview ("Centro de operações")
// Depends on window.WF and window.AdminIcon (AIcon). Clickable navigation via React state.
const { Icon: PIcon } = window.WF;
const AIcon = window.WF.AdminIcon;
const { useState } = React;

// ---- interactive sidebar (navigable) ----
function NavSidebar({ active, go }) {
  const groups = [
    { items: [['overview', 'grid', 'Visão geral']] },
    { label: 'Gestão', items: [['users', 'users', 'Usuários & papéis'], ['sso', 'lock', 'SSO & acesso']] },
    { label: 'IA · MLOps', items: [['models', 'cpu', 'Modelos & LoRA']] },
    { label: 'Governança', items: [['audit', 'scroll', 'Auditoria'], ['compliance', 'file', 'Compliance LGPD'], ['retention', 'lock', 'Retenção de dados']] },
    { label: 'FinOps', items: [['usage', 'money', 'Uso & custos']] },
    { label: 'Integrações', items: [['keys', 'plug', 'API keys'], ['webhooks', 'activity', 'Webhooks']] },
    { label: 'Marca', items: [['branding', 'palette', 'White-label']] },
  ];
  return (
    <div className="wf-side" style={{ width: 236, paddingTop: 16, overflowY: 'hidden' }}>
      <div className="wf-brand" style={{ paddingBottom: 8 }}><span className="mk">A</span><b>Acme&nbsp;IA</b></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 8px 12px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>Administração</span>
        <span className="wf-pill" style={{ padding: '1px 7px', fontSize: 9.5, marginLeft: 'auto' }}>Enterprise</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginRight: -6, paddingRight: 6 }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="wf-seclbl" style={{ padding: '10px 10px 4px' }}>{g.label}</div>}
            {g.items.map(([id, ic, label]) => {
              const live = true;
              return (
                <div key={id} onClick={() => live && go(id)}
                  className={'wf-navi' + (id === active ? ' on' : '')}
                  style={{ fontSize: 13, cursor: live ? 'pointer' : 'default', opacity: live ? 1 : 0.55 }}>
                  <span className="ic"><AIcon name={ic} size={15} /></span>{label}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="wf-user" style={{ marginTop: 8 }}>
        <span className="wf-av" style={{ width: 28, height: 28, fontSize: 11 }}>HM</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Helena Marques</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink3)' }}>Admin · Workspace Acme</div>
        </div>
      </div>
    </div>
  );
}

function Head({ title, sub, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px 28px 16px', borderBottom: '1px solid var(--line)', gap: 16, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>
    </div>
  );
}

// ---- Overview ----
function Overview({ go }) {
  const services = [['API', 1], ['GPU · vLLM', 1], ['PostgreSQL', 1], ['Qdrant', 1], ['Embedding', 1]];

  // The hero of the redesign: a prioritised action queue replacing the bare emoji grid.
  const actions = [
    { sev: 'critical', icon: 'alert', title: '3 usuários sem MFA habilitado', desc: 'Reduz o score de Controle de Acesso no relatório LGPD.', cta: 'Revisar usuários', go: () => go('users', { filter: 'no-mfa' }) },
    { sev: 'warning', icon: 'users', title: '2 convites pendentes há mais de 7 dias', desc: 'Diego Santos e mais 1 ainda não aceitaram o convite.', cta: 'Reenviar', go: () => go('users', { filter: 'pending' }) },
    { sev: 'info', icon: 'dna', title: 'Novo LoRA adapter pronto — v2026.05.3', desc: '+2,4% de acurácia vs. versão ativa. Hot-swap sem downtime.', cta: 'Ativar modelo' },
    { sev: 'warning', icon: 'money', title: 'Custo de GPU +18% vs. mês anterior', desc: 'Pico de inferência no projeto Atendimento nos últimos 5 dias.', cta: 'Ver custos' },
  ];
  const sevColor = { critical: 'var(--acc)', warning: '#c08a2e', info: 'var(--ink3)' };
  const sevBg = { critical: 'var(--acc-soft)', warning: '#faf3e6', info: 'var(--panel)' };
  const sevLine = { critical: 'var(--acc-line)', warning: '#ecd9b0', info: 'var(--line)' };

  const kpis = [['342', 'Usuários ativos', '↑ 18 no mês', 1], ['2.447', 'Conversas · 30d', '↑ 6%', 1], ['7,5M', 'Tokens · 30d', '', 0], ['R$ 12,31', 'Custo / usuário·mês', '↓ 3%', 1]];
  const nav = [
    ['users', 'users', 'Usuários & papéis', '342 membros · 3 papéis'],
    ['audit', 'scroll', 'Auditoria', '1.204 eventos · 30d'],
    ['compliance', 'file', 'Compliance LGPD', 'Score 92 · 1 pendência'],
    ['keys', 'plug', 'API keys', '4 ativas · 1 expira em 9d'],
    ['models', 'cpu', 'Modelos & LoRA', 'Llama 3.3 70B ativo'],
    ['sso', 'lock', 'SSO & acesso', 'Google · Microsoft'],
  ];

  return (
    <>
      <Head title="Visão geral" sub="Workspace Acme · Enterprise · atualizado há 2 min"
        actions={<>
          <span className="wf-pill" style={{ cursor: 'default' }}>Últimos 30 dias<PIcon name="chevron" size={12} color="#9a958d" /></span>
          <span className="wf-btn gho"><AIcon name="download" size={14} />Exportar</span>
        </>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>

          {/* health strip — consolidated, full width */}
          <div className="wf-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <span className="wf-pill good" style={{ padding: '4px 11px', fontSize: 12 }}><PIcon name="check" size={12} />Sistema operacional</span>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flex: 1 }}>
              {services.map((s) => (
                <span key={s[0]} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 9, background: s[1] ? 'var(--good)' : 'var(--acc)' }} />{s[0]}
                </span>
              ))}
            </div>
            <span className="wf-mono" style={{ fontSize: 11.5, color: 'var(--ink3)' }}>uptime 99,98% · latência 240ms</span>
          </div>

          {/* PENDING ACTIONS — the redesign's centrepiece */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '26px 0 12px' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Precisa da sua atenção</div>
            <span className="wf-pill acc" style={{ padding: '1px 8px', fontSize: 11 }}>4</span>
            <span style={{ fontSize: 12, color: 'var(--ink3)', marginLeft: 'auto' }}>ações priorizadas por impacto</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {actions.map((a, i) => (
              <div key={i} className="wf-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 13, borderColor: sevLine[a.sev], background: sevBg[a.sev] }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', boxShadow: 'inset 0 0 0 1px ' + sevLine[a.sev] }}>
                  <AIcon name={a.icon} size={16} color={sevColor[a.sev]} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: a.sev === 'info' ? 'var(--ink)' : sevColor[a.sev] }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 3, lineHeight: 1.45 }}>{a.desc}</div>
                  <div onClick={a.go || (() => {})} className={'wf-btn ' + (a.sev === 'critical' ? 'acc' : 'gho')}
                    style={{ padding: '6px 12px', fontSize: 12, marginTop: 11, cursor: a.go ? 'pointer' : 'default' }}>
                    {a.cta}<PIcon name="arrow" size={13} color={a.sev === 'critical' ? '#fff' : 'currentColor'} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* KPI strip + GPU + cost */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.85fr 1fr', gap: 12, marginTop: 26 }}>
            {/* KPIs 2x2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {kpis.map((k) => (
                <div key={k[1]} className="wf-card" style={{ padding: 15 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{k[1]}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.01em' }}>{k[0]}</span>
                    {k[2] && <span className="wf-mono" style={{ fontSize: 11, color: k[3] ? 'var(--good)' : 'var(--ink3)' }}>{k[2]}</span>}
                  </div>
                </div>
              ))}
            </div>
            {/* GPU gauge */}
            <div className="wf-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink3)' }}>
                <span><AIcon name="cpu" size={13} color="#9a958d" style={{ verticalAlign: -2 }} /> GPU</span><span className="wf-mono">A100</span>
              </div>
              <window.Gauge value={73} sub="GPU util" color="var(--acc)" size={104} />
              <div style={{ width: '100%', fontSize: 11, color: 'var(--ink2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>VRAM</span><span className="wf-mono">58 / 80 GB</span></div>
                <window.MiniBar value={72} color="var(--ink)" h={6} />
              </div>
            </div>
            {/* cost */}
            <div className="wf-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginBottom: 8 }}><AIcon name="money" size={13} color="#9a958d" style={{ verticalAlign: -2 }} /> Custo estimado · 30d</div>
              <div style={{ fontSize: 26, fontWeight: 600 }}>R$ 4.210</div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11.5, color: 'var(--ink2)' }}>
                {[['GPU (local)', 'R$ 3.180', 76], ['Storage', 'R$ 640', 15], ['Rede', 'R$ 390', 9]].map((c) => (
                  <div key={c[0]}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>{c[0]}</span><span className="wf-mono">{c[1]}</span></div>
                    <window.MiniBar value={c[2]} color={c[0].includes('GPU') ? 'var(--acc)' : 'var(--ink3)'} h={5} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* clean navigation grid — fixes the deformed auto-fill emoji grid */}
          <div style={{ fontSize: 15, fontWeight: 600, margin: '28px 0 12px' }}>Áreas de administração</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {nav.map(([id, ic, title, desc]) => {
              const live = id === 'users';
              return (
                <div key={id} onClick={() => live && go(id)} className="wf-card pnav"
                  style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 13, cursor: live ? 'pointer' : 'default' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel2)' }}>
                    <AIcon name={ic} size={18} color="var(--ink2)" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>{desc}</div>
                  </div>
                  <PIcon name="arrow" size={15} color="#c9c4bb" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ---- shared helpers reused across screens ----
function Back({ go, label = 'Visão geral' }) {
  return (
    <div onClick={() => go('overview')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink3)', cursor: 'pointer', marginBottom: 14 }}>
      <PIcon name="arrow" size={13} color="#9a958d" style={{ transform: 'rotate(180deg)' }} />{label}
    </div>
  );
}

function SecHead({ title, note, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '26px 0 12px' }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      {note && <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{note}</span>}
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  );
}

function KpiRow({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12 }}>
      {items.map((k) => (
        <div key={k.label} className="wf-card" style={{ padding: 15 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{k.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.01em' }}>{k.value}</span>
            {k.trend && <span className="wf-mono" style={{ fontSize: 11, color: k.up ? 'var(--good)' : (k.warn ? 'var(--acc)' : 'var(--ink3)') }}>{k.trend}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Toggle({ on }) {
  return (
    <span style={{ width: 34, height: 20, borderRadius: 12, background: on ? 'var(--ink)' : 'var(--line)', position: 'relative', flexShrink: 0, transition: 'background .15s', cursor: 'pointer', display: 'inline-block' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 9, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
    </span>
  );
}

function BarChart({ data, color = 'var(--ink)', accColor = 'var(--acc)', accIndex = -1, h = 120, unit = '' }) {
  const max = Math.max(...data.map((d) => d.v));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: h }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <div title={d.v + unit} style={{ width: '100%', maxWidth: 28, borderRadius: '4px 4px 0 0', background: i === accIndex ? accColor : color, height: `${(d.v / max) * 100}%`, minHeight: 3 }} />
          <span style={{ fontSize: 9.5, color: 'var(--ink3)' }}>{d.l}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ kind, children }) {
  const m = { ok: 'good', warn: '', bad: 'acc' };
  return <span className={'wf-pill ' + (m[kind] || '')} style={{ padding: '2px 9px', fontSize: 10.5 }}>{children}</span>;
}

window.AdminProposalShell = { NavSidebar, Head, Back, SecHead, KpiRow, Toggle, BarChart, StatusPill };
window.AdminProposalOverview = Overview;
