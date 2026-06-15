// wf-admin-kit.jsx — admin shell + governance primitives. Depends on window.WF.
const { Icon: WIcon, Nov: WNov, Av: WAv } = window.WF;

// extra icons for admin
(function () {
  const extra = {
    grid:   'M3 3h6v6H3z M11 3h6v6h-6z M3 11h6v6H3z M11 11h6v6h-6z',
    users:  'M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M2 16a5 5 0 0 1 10 0 M14 8a2.5 2.5 0 1 0-1-4.8 M13 16a5 5 0 0 0-1-3.5',
    cpu:    'M6 6h8v8H6z M8 1v3 M12 1v3 M8 16v3 M12 16v3 M1 8h3 M1 12h3 M16 8h3 M16 12h3',
    scroll: 'M5 3h10v14H5z M8 7h4 M8 10h4 M8 13h2',
    file:   'M5 2h7l4 4v12H5z M12 2v4h4',
    money:  'M10 3v14 M13 6.5C13 5 11.7 4.3 10 4.3S7 5 7 6.4c0 3 6 1.6 6 4.6 0 1.5-1.3 2.2-3 2.2s-3-.7-3-2.2',
    plug:   'M7 3v4 M13 3v4 M5 7h10v3a5 5 0 0 1-10 0z M10 15v3',
    palette:'M10 2a8 8 0 1 0 0 16c1 0 1.5-.8 1.5-1.6 0-1 .8-1.4 1.7-1.4H15a3 3 0 0 0 3-3c0-4.4-3.6-7-8-7 M6 9a1 1 0 1 0 0-2 M10 6a1 1 0 1 0 0-2 M13.5 8.5a1 1 0 1 0 0-2',
    lock:   'M5 9h10v8H5z M7 9V6a3 3 0 0 1 6 0v3',
    refresh:'M16 5a7 7 0 1 0 1.5 5 M16 2v4h-4',
    dna:    'M6 3c0 5 8 5 8 10 M14 3c0 5-8 5-8 10 M6.5 6h7 M6.5 14h7 M8 4.5h4 M8 15.5h4',
    download:'M10 3v9 M6 9l4 4 4-4 M4 16h12',
    alert:  'M10 3l8 14H2z M10 8v4 M10 15h.01',
    activity:'M2 10h4l2-5 4 11 2-6h4',
    eye:    'M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z M10 12a2 2 0 1 0 0-4',
    play:   'M6 4l9 6-9 6z',
    pause:  'M6 4h3v12H6z M11 4h3v12h-3z',
  };
  // monkeypatch the icon path table by wrapping
  const base = window.WF.Icon;
  window.WF.AdminIcon = function ({ name, size = 17, stroke = 1.6, color = 'currentColor', style }) {
    const d = extra[name];
    if (!d) return base({ name, size, stroke, color, style });
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
        <path d={d} />
      </svg>
    );
  };
})();
const AIcon = window.WF.AdminIcon;

// Admin sidebar — grouped by governance area, role=admin
function AdminSidebar({ active, user = { name: 'Helena M.', ws: 'Workspace Acme', mk: 'H' } }) {
  const groups = [
    { items: [['dashboard', 'grid', 'Visão geral']] },
    { label: 'Gestão', items: [['users', 'users', 'Usuários & papéis'], ['sso', 'lock', 'SSO & acesso']] },
    { label: 'IA · MLOps', items: [['models', 'cpu', 'Modelos & LoRA']] },
    { label: 'Governança', items: [['audit', 'scroll', 'Auditoria'], ['compliance', 'file', 'Compliance LGPD'], ['retention', 'lock', 'Retenção de dados']] },
    { label: 'FinOps', items: [['usage', 'money', 'Uso & custos']] },
    { label: 'Integrações', items: [['keys', 'plug', 'API keys'], ['webhooks', 'activity', 'Webhooks']] },
    { label: 'Marca', items: [['branding', 'palette', 'White-label']] },
  ];
  return (
    <div className="wf-side" style={{ width: 232, paddingTop: 16, overflowY: 'hidden' }}>
      <div className="wf-brand" style={{ paddingBottom: 8 }}><span className="mk">{user.mk}</span><b>Acme&nbsp;IA</b></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 8px 12px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>Administração</span>
        <span className="wf-pill" style={{ padding: '1px 7px', fontSize: 9.5, marginLeft: 'auto' }}>Enterprise</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginRight: -6, paddingRight: 6 }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="wf-seclbl" style={{ padding: '10px 10px 4px' }}>{g.label}</div>}
            {g.items.map(([id, ic, label]) => (
              <div key={id} className={'wf-navi' + (id === active ? ' on' : '')} style={{ fontSize: 13 }}>
                <span className="ic"><AIcon name={ic} size={15} /></span>{label}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="wf-user" style={{ marginTop: 8 }}>
        <WAv size={28}>{user.mk}M</WAv>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{user.name}</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink3)' }}>Admin · {user.ws}</div>
        </div>
      </div>
    </div>
  );
}

// page header used across admin screens
function AdminHead({ title, sub, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px 28px 16px', borderBottom: '1px solid var(--line)', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>
    </div>
  );
}

// Donut gauge (GPU util etc.)
function Gauge({ value, label, sub, color = 'var(--ink)', size = 116 }) {
  const r = 46, c = 2 * Math.PI * r, dash = (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="11" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fontSize="26" fontWeight="600" fill="var(--ink)" fontFamily="IBM Plex Sans">{value}%</text>
      <text x="60" y="76" textAnchor="middle" fontSize="11" fill="var(--ink3)" fontFamily="IBM Plex Mono">{sub}</text>
    </svg>
  );
}

// labelled mini progress bar
function MiniBar({ value, max = 100, color = 'var(--ink)', h = 7 }) {
  return (
    <div style={{ background: 'var(--line2)', borderRadius: 5, height: h, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', background: color, borderRadius: 5 }} />
    </div>
  );
}

// status dot + label
function Health({ ok, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink2)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 9, background: ok ? 'var(--good)' : 'var(--acc)', flexShrink: 0 }} />{label}
    </div>
  );
}

// KPI tile
function Kpi({ value, label, trend, trendUp }) {
  return (
    <div className="wf-card" style={{ padding: 15, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.01em' }}>{value}</span>
        {trend && <span className="wf-mono" style={{ fontSize: 11, color: trendUp ? 'var(--good)' : 'var(--ink3)' }}>{trend}</span>}
      </div>
    </div>
  );
}

// severity dot for audit
function Sev({ level }) {
  const m = { info: ['var(--ink3)', 'Info'], warning: ['#c08a2e', 'Atenção'], critical: ['var(--acc)', 'Crítico'] };
  const [c] = m[level] || m.info;
  return <span style={{ width: 9, height: 9, borderRadius: 9, background: c, flexShrink: 0, display: 'inline-block' }} />;
}

Object.assign(window, { AdminSidebar, AdminHead, Gauge, MiniBar, Health, Kpi, Sev, AIcon });
