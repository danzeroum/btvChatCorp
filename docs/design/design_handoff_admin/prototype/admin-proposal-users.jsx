// admin-proposal-users.jsx — Users subscreen + user-detail drawer (deeper subtela)
const { Icon: UIcon } = window.WF;
const UAIcon = window.WF.AdminIcon;
const { useState: useStateU } = React;

const USERS = [
  { id: 'helena', name: 'Helena Marques', email: 'helena@acme.com', role: 'Admin', status: 'active', mfa: 1, last: '30/05 09:12', joined: '12/01/2025', team: 'Plataforma', msgs: 312, sessions: 2 },
  { id: 'rafael', name: 'Rafael Costa', email: 'rafael@acme.com', role: 'Curador', status: 'active', mfa: 1, last: '30/05 08:40', joined: '03/02/2025', team: 'Jurídico', msgs: 511, sessions: 1 },
  { id: 'mariana', name: 'Mariana Alves', email: 'mariana@acme.com', role: 'Membro', status: 'active', mfa: 0, last: '30/05 09:31', joined: '21/02/2025', team: 'Atendimento', msgs: 842, sessions: 3 },
  { id: 'bruno', name: 'Bruno Lima', email: 'bruno@acme.com', role: 'Membro', status: 'active', mfa: 0, last: '29/05 17:22', joined: '08/03/2025', team: 'Atendimento', msgs: 377, sessions: 1 },
  { id: 'diego', name: 'Diego Santos', email: 'diego@acme.com', role: 'Membro', status: 'pending', mfa: 0, last: '—', joined: 'Convite 21/05', team: 'Comercial', msgs: 0, sessions: 0 },
  { id: 'paula', name: 'Paula Nunes', email: 'paula@acme.com', role: 'Membro', status: 'pending', mfa: 0, last: '—', joined: 'Convite 19/05', team: 'RH', msgs: 0, sessions: 0 },
  { id: 'carla', name: 'Carla Dias', email: 'carla@acme.com', role: 'Membro', status: 'suspended', mfa: 1, last: '12/05 11:05', joined: '15/01/2025', team: 'Comercial', msgs: 190, sessions: 0 },
];

const ST = { active: ['Ativo', 'good'], pending: ['Pendente', ''], suspended: ['Suspenso', 'acc'] };
const initials = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('');

function Users({ go, initialFilter }) {
  const { Head } = window.AdminProposalShell;
  const [filter, setFilter] = useStateU(initialFilter || 'all');
  const [selected, setSelected] = useStateU([]);
  const [open, setOpen] = useStateU(null); // user id for drawer

  const chips = [['all', 'Todos'], ['Admin', 'Admin'], ['Curador', 'Curador'], ['Membro', 'Membro'], ['pending', 'Pendentes'], ['no-mfa', 'Sem MFA'], ['suspended', 'Suspensos']];
  const match = (u) => {
    if (filter === 'all') return true;
    if (filter === 'no-mfa') return !u.mfa && u.status === 'active';
    if (filter === 'pending') return u.status === 'pending';
    if (filter === 'suspended') return u.status === 'suspended';
    return u.role === filter;
  };
  const rows = USERS.filter(match);
  const allSel = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(allSel ? [] : rows.map((r) => r.id));

  const kpis = [['342', 'Total de usuários'], ['3', 'Administradores'], ['91%', 'Com MFA', 'alvo 100%'], ['2', 'Convites pendentes']];
  const cols = '34px 1.7fr 110px 96px 60px 116px 40px';

  return (
    <>
      <Head title="Usuários & papéis" sub="342 membros · 3 papéis · provisionamento por SSO"
        actions={<>
          <span className="wf-pill" style={{ cursor: 'default' }}><UIcon name="search" size={13} color="#9a958d" />Buscar</span>
          <span className="wf-btn pri"><UIcon name="plus" size={14} color="#fff" />Convidar</span>
        </>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          {/* breadcrumb back to overview */}
          <div onClick={() => go('overview')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink3)', cursor: 'pointer', marginBottom: 14 }}>
            <UIcon name="arrow" size={13} color="#9a958d" style={{ transform: 'rotate(180deg)' }} />Visão geral
          </div>

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            {kpis.map((k) => (
              <div key={k[1]} className="wf-card" style={{ padding: 15 }}>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{k[1]}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 25, fontWeight: 600 }}>{k[0]}</span>
                  {k[2] && <span className="wf-mono" style={{ fontSize: 11, color: 'var(--ink3)' }}>{k[2]}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* filter chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {chips.map(([id, label]) => (
              <span key={id} onClick={() => { setFilter(id); setSelected([]); }}
                className={'wf-chip' + (filter === id ? ' on' : '')}
                style={{ cursor: 'pointer', fontSize: 12, padding: '5px 11px', ...(filter === id ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : {}) }}>
                {label}{id === 'no-mfa' && <span style={{ color: filter === id ? '#fff' : 'var(--acc)' }}>·2</span>}
              </span>
            ))}
          </div>

          {/* bulk action bar */}
          {selected.length > 0 && (
            <div className="wf-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, borderColor: 'var(--acc-line)', background: 'var(--acc-soft)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--acc)' }}>{selected.length} selecionado(s)</span>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <span className="wf-chip" style={{ cursor: 'pointer', fontSize: 11.5 }}>Mudar papel</span>
                <span className="wf-chip" style={{ cursor: 'pointer', fontSize: 11.5 }}>Exigir MFA</span>
                <span className="wf-chip" style={{ cursor: 'pointer', fontSize: 11.5 }}>Suspender</span>
              </div>
            </div>
          )}

          {/* table */}
          <div className="wf-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 16px', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 600, borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
              <span><Box on={allSel} onClick={toggleAll} /></span>
              <span>Usuário</span><span>Papel</span><span>Status</span><span>MFA</span><span>Último acesso</span><span></span>
            </div>
            {rows.map((u) => (
              <div key={u.id} onClick={() => setOpen(u.id)}
                className="urow"
                style={{ display: 'grid', gridTemplateColumns: cols, padding: '11px 16px', alignItems: 'center', fontSize: 12.5, borderTop: '1px solid var(--line2)', cursor: 'pointer', background: selected.includes(u.id) ? 'var(--panel)' : 'transparent' }}>
                <span onClick={(e) => { e.stopPropagation(); toggle(u.id); }}><Box on={selected.includes(u.id)} /></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span className="wf-av" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(u.name)}</span>
                  <span style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{u.name}</div><div className="wf-mono" style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{u.email}</div></span>
                </span>
                <span><span className="wf-chip" style={{ fontSize: 11, ...(u.role === 'Admin' ? { borderColor: 'var(--acc-line)', color: 'var(--acc)', background: 'var(--acc-soft)' } : {}) }}>{u.role}</span></span>
                <span><span className={'wf-pill ' + ST[u.status][1]} style={{ padding: '2px 9px', fontSize: 10.5 }}>{ST[u.status][0]}</span></span>
                <span>{u.mfa ? <UIcon name="check" size={15} color="#3f7d62" /> : <span style={{ fontSize: 12, color: 'var(--acc)', fontWeight: 600 }}>✕</span>}</span>
                <span className="wf-mono" style={{ fontSize: 11, color: 'var(--ink3)' }}>{u.last}</span>
                <span><UIcon name="chevron" size={14} color="#c9c4bb" style={{ transform: 'rotate(-90deg)' }} /></span>
              </div>
            ))}
            {rows.length === 0 && <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--ink3)' }}>Nenhum usuário neste filtro.</div>}
          </div>
        </div>
      </div>

      {open && <UserDrawer user={USERS.find((u) => u.id === open)} onClose={() => setOpen(null)} />}
    </>
  );
}

function Box({ on, onClick }) {
  return (
    <span onClick={onClick} style={{ width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 1.5px ' + (on ? 'var(--ink)' : 'var(--line)'), background: on ? 'var(--ink)' : '#fff', cursor: 'pointer' }}>
      {on && <UIcon name="check" size={11} color="#fff" stroke={2.4} />}
    </span>
  );
}

// ---- USER DETAIL DRAWER (deeper subtela) ----
function UserDrawer({ user, onClose }) {
  const [role, setRole] = useStateU(user.role);
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(28,27,25,0.28)', display: 'flex', justifyContent: 'flex-end', zIndex: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, background: '#fff', height: '100%', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(28,27,25,0.10)' }}>
        {/* drawer header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <span className="wf-av" style={{ width: 44, height: 44, fontSize: 16 }}>{initials(user.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{user.name}</div>
            <div className="wf-mono" style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>{user.email}</div>
            <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
              <span className={'wf-pill ' + ST[user.status][1]} style={{ padding: '2px 9px', fontSize: 10.5 }}>{ST[user.status][0]}</span>
              <span className="wf-chip" style={{ fontSize: 11 }}>{user.team}</span>
            </div>
          </div>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 18, color: 'var(--ink3)', lineHeight: 1, padding: 2 }}>✕</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* MFA alert if missing */}
          {!user.mfa && user.status === 'active' && (
            <div className="wf-card" style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 11, borderColor: 'var(--acc-line)', background: 'var(--acc-soft)', marginBottom: 18 }}>
              <UAIcon name="alert" size={16} color="#bf5b3d" />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--acc)', fontWeight: 600 }}>MFA não habilitado</div>
              <span className="wf-btn acc" style={{ padding: '6px 11px', fontSize: 11.5, cursor: 'pointer' }}>Exigir agora</span>
            </div>
          )}

          {/* role selector */}
          <Section label="Papel & permissões" />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {['Admin', 'Curador', 'Membro'].map((r) => (
              <span key={r} onClick={() => setRole(r)} className="wf-chip"
                style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', fontSize: 12, padding: '8px 0', ...(role === r ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : {}) }}>{r}</span>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', lineHeight: 1.5, marginBottom: 20 }}>
            {role === 'Admin' && 'Acesso total: gestão de usuários, modelos, billing e governança.'}
            {role === 'Curador' && 'Gerencia bases de conhecimento e avalia respostas. Sem acesso a billing.'}
            {role === 'Membro' && 'Usa o chat e projetos atribuídos. Sem acesso administrativo.'}
          </div>

          {/* meta grid */}
          <Section label="Detalhes" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px', marginBottom: 20 }}>
            {[['Entrou', user.joined], ['Último acesso', user.last], ['Mensagens · 30d', String(user.msgs)], ['Sessões ativas', String(user.sessions)]].map((m) => (
              <div key={m[0]}>
                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{m[0]}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{m[1]}</div>
              </div>
            ))}
          </div>

          {/* recent activity */}
          <Section label="Atividade recente" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 8 }}>
            {[['Login via Google SSO', '30/05 09:12'], ['Criou projeto "Tickets Q2"', '29/05 16:40'], ['Exportou conversa', '28/05 11:02']].map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--line2)' : 'none', fontSize: 12.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9, background: 'var(--ink3)', marginTop: 6, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--ink2)' }}>{e[0]}</span>
                <span className="wf-mono" style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{e[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* danger zone / footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
          <span className="wf-btn pri" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer' }}>Salvar alterações</span>
          <span className="wf-btn gho" style={{ cursor: 'pointer', color: 'var(--acc)', boxShadow: 'inset 0 0 0 1px var(--acc-line)' }}>
            {user.status === 'suspended' ? 'Reativar' : 'Suspender'}
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({ label }) {
  return <div className="wf-seclbl" style={{ padding: '0 0 9px' }}>{label}</div>;
}

window.AdminProposalUsers = Users;
