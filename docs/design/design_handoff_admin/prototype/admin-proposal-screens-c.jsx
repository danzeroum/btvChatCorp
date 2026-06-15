// admin-proposal-screens-c.jsx — Uso & custos, API keys, Webhooks, SSO, White-label
const CIcon = window.WF.Icon;
const CAIcon = window.WF.AdminIcon;
const { useState: useStateC } = React;

// ============ USO & CUSTOS (FinOps) ============
function Usage({ go }) {
  const { Head, Back, SecHead, KpiRow, BarChart } = window.AdminProposalShell;
  const days = [{ l: 'S1', v: 980 }, { l: 'S2', v: 1120 }, { l: 'S3', v: 1310 }, { l: 'S4', v: 1580 }, { l: 'S5', v: 1490 }, { l: 'S6', v: 1720 }];
  const projects = [
    { name: 'Atendimento', tokens: '4,1M', cost: 'R$ 2.180', pct: 52, up: '+18%' },
    { name: 'Jurídico', tokens: '1,8M', cost: 'R$ 980', pct: 23, up: '+4%' },
    { name: 'Comercial', tokens: '0,9M', cost: 'R$ 620', pct: 15, up: '−2%' },
    { name: 'RH', tokens: '0,7M', cost: 'R$ 430', pct: 10, up: '+1%' },
  ];
  return (
    <>
      <Head title="Uso & custos" sub="FinOps · estimativa de custo de infraestrutura"
        actions={<><span className="wf-pill" style={{ cursor: 'default' }}>Maio 2026<CIcon name="chevron" size={12} color="#9a958d" /></span><span className="wf-btn gho"><CAIcon name="download" size={14} />Exportar CSV</span></>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <Back go={go} />
          <KpiRow items={[
            { value: 'R$ 4.210', label: 'Custo · 30d', trend: '+12%', warn: true },
            { value: 'R$ 12,31', label: 'Custo / usuário', trend: '↓ 3%', up: true },
            { value: '7,5M', label: 'Tokens · 30d' },
            { value: '540h', label: 'GPU · horas' },
          ]} />

          {/* budget alert */}
          <div className="wf-card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, borderColor: 'var(--acc-line)', background: 'var(--acc-soft)' }}>
            <CAIcon name="alert" size={16} color="#bf5b3d" />
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--acc)' }}><b>84% do orçamento mensal</b> utilizado (R$ 4.210 de R$ 5.000). Projeção: R$ 5.180 até o fim do mês.</div>
            <span className="wf-chip" style={{ fontSize: 11, cursor: 'pointer', background: '#fff' }}>Ajustar limite</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginTop: 20 }}>
            {/* trend chart */}
            <div className="wf-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><span style={{ fontSize: 13, fontWeight: 600 }}>Custo por semana</span><span className="wf-mono" style={{ fontSize: 11, color: 'var(--ink3)' }}>R$ / semana</span></div>
              <BarChart data={days} color="var(--ink)" accIndex={5} h={140} />
            </div>
            {/* cost split */}
            <div className="wf-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Composição do custo</div>
              {[['GPU (inferência local)', 'R$ 3.180', 76, 'var(--acc)'], ['Storage', 'R$ 640', 15, 'var(--ink)'], ['Rede / egress', 'R$ 390', 9, 'var(--ink3)']].map((c) => (
                <div key={c[0]} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}><span style={{ color: 'var(--ink2)' }}>{c[0]}</span><span className="wf-mono" style={{ fontWeight: 600 }}>{c[1]}</span></div>
                  <window.MiniBar value={c[2]} color={c[3]} h={6} />
                </div>
              ))}
            </div>
          </div>

          {/* by project */}
          <SecHead title="Custo por projeto" />
          <div className="wf-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 110px 1fr 80px', padding: '10px 16px', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
              <span>Projeto</span><span>Tokens</span><span>Custo</span><span>Participação</span><span>Mês</span>
            </div>
            {projects.map((p) => (
              <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 110px 1fr 80px', padding: '12px 16px', alignItems: 'center', fontSize: 12.5, borderTop: '1px solid var(--line2)' }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="wf-mono" style={{ color: 'var(--ink2)' }}>{p.tokens}</span>
                <span className="wf-mono" style={{ fontWeight: 600 }}>{p.cost}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1 }}><window.MiniBar value={p.pct} color="var(--ink)" h={6} /></div><span className="wf-mono" style={{ fontSize: 11, color: 'var(--ink3)', width: 30 }}>{p.pct}%</span></span>
                <span className="wf-mono" style={{ fontSize: 11.5, color: p.up.startsWith('+') ? 'var(--acc)' : 'var(--good)' }}>{p.up}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ API KEYS ============
function Keys({ go }) {
  const { Head, Back, SecHead, KpiRow, StatusPill } = window.AdminProposalShell;
  const [created, setCreated] = useStateC(false);
  const keys = [
    { name: 'Produção · backend', prefix: 'sk_live_a9f2…3c1', scope: 'read-write', created: '12/01/2025', used: 'há 2 min', exp: '—', status: 'active' },
    { name: 'Integração CRM', prefix: 'sk_live_77be…9d0', scope: 'read-only', created: '03/02/2025', used: 'há 1 h', exp: 'em 9 dias', status: 'expiring' },
    { name: 'Webhook relay', prefix: 'sk_live_2c4d…8a2', scope: 'read-write', created: '20/03/2025', used: 'há 3 d', exp: '—', status: 'active' },
    { name: 'Dev sandbox', prefix: 'sk_test_0011…ff9', scope: 'read-only', created: '08/05/2025', used: 'nunca', exp: 'revogada', status: 'revoked' },
  ];
  const sm = { active: ['Ativa', 'ok'], expiring: ['Expira em breve', 'warn'], revoked: ['Revogada', 'bad'] };
  return (
    <>
      <Head title="API keys" sub="Chaves de acesso programático · rotação recomendada a cada 90 dias"
        actions={<span onClick={() => setCreated(true)} className="wf-btn pri" style={{ cursor: 'pointer' }}><CIcon name="plus" size={14} color="#fff" />Nova chave</span>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Back go={go} />
          <KpiRow items={[
            { value: '4', label: 'Chaves ativas' },
            { value: '1', label: 'Expira em 9 dias', warn: true },
            { value: '2.4M', label: 'Requisições · 30d' },
            { value: '5.000', label: 'Limite / min' },
          ]} />

          {created && (
            <div className="wf-card" style={{ padding: 16, marginTop: 14, background: 'var(--good-soft)', borderColor: '#cfe1d7' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--good)', marginBottom: 8 }}>Chave criada — copie agora, ela não será exibida novamente</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <code className="wf-mono" style={{ flex: 1, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>sk_live_d3b8f1a07e294c6b9f2a18c4e5d6079b</code>
                <span className="wf-btn gho" style={{ cursor: 'pointer' }}>Copiar</span>
              </div>
            </div>
          )}

          <SecHead title="Chaves" note={keys.length + ' no total'} />
          <div className="wf-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.2fr 100px 110px 120px 60px', padding: '10px 16px', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
              <span>Nome</span><span>Chave</span><span>Escopo</span><span>Último uso</span><span>Status</span><span></span>
            </div>
            {keys.map((k) => (
              <div key={k.name} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.2fr 100px 110px 120px 60px', padding: '12px 16px', alignItems: 'center', fontSize: 12.5, borderTop: '1px solid var(--line2)', opacity: k.status === 'revoked' ? 0.55 : 1 }}>
                <span style={{ fontWeight: 600 }}>{k.name}<div style={{ fontSize: 10.5, color: 'var(--ink3)', fontWeight: 400 }}>criada {k.created}</div></span>
                <span className="wf-mono" style={{ fontSize: 11.5, color: 'var(--ink2)' }}>{k.prefix}</span>
                <span><span className="wf-chip" style={{ fontSize: 11 }}>{k.scope}</span></span>
                <span className="wf-mono" style={{ fontSize: 11, color: 'var(--ink3)' }}>{k.used}</span>
                <span><StatusPill kind={sm[k.status][1]}>{sm[k.status][0]}</StatusPill></span>
                <span>{k.status !== 'revoked' && <span style={{ fontSize: 11.5, color: 'var(--acc)', cursor: 'pointer' }}>Revogar</span>}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ WEBHOOKS ============
function Webhooks({ go }) {
  const { Head, Back, SecHead, KpiRow, StatusPill } = window.AdminProposalShell;
  const endpoints = [
    { url: 'https://crm.acme.com/hooks/chat', events: 'conversation.*', status: 'active', last: '200 · há 4 min', rate: '99,8%' },
    { url: 'https://api.acme.com/audit-sink', events: 'audit.*, user.*', status: 'active', last: '200 · há 1 h', rate: '100%' },
    { url: 'https://hooks.slack.com/T0/B1', events: 'alert.critical', status: 'failing', last: '503 · há 12 min', rate: '88,1%' },
  ];
  const deliveries = [
    { ev: 'conversation.created', code: 200, t: '09:31:04', ok: true },
    { ev: 'alert.critical', code: 503, t: '09:19:55', ok: false },
    { ev: 'user.suspended', code: 200, t: '08:48:12', ok: true },
    { ev: 'audit.export', code: 200, t: '08:40:01', ok: true },
    { ev: 'alert.critical', code: 503, t: '08:07:33', ok: false },
  ];
  return (
    <>
      <Head title="Webhooks" sub="Notificações HTTP de eventos para sistemas externos"
        actions={<span className="wf-btn pri"><CIcon name="plus" size={14} color="#fff" />Novo endpoint</span>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Back go={go} />
          <KpiRow items={[
            { value: '3', label: 'Endpoints' },
            { value: '1', label: 'Com falha', warn: true },
            { value: '12.4k', label: 'Entregas · 24h' },
            { value: '96,2%', label: 'Taxa de sucesso' },
          ]} />

          <SecHead title="Endpoints" />
          <div className="wf-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.3fr 90px 150px 90px', padding: '10px 16px', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
              <span>URL</span><span>Eventos</span><span>Status</span><span>Última entrega</span><span>Sucesso</span>
            </div>
            {endpoints.map((e) => (
              <div key={e.url} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.3fr 90px 150px 90px', padding: '12px 16px', alignItems: 'center', fontSize: 12.5, borderTop: '1px solid var(--line2)' }}>
                <span className="wf-mono" style={{ fontSize: 11.5, color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url}</span>
                <span><span className="wf-chip wf-mono" style={{ fontSize: 10.5 }}>{e.events}</span></span>
                <span><StatusPill kind={e.status === 'active' ? 'ok' : 'bad'}>{e.status === 'active' ? 'Ativo' : 'Falhando'}</StatusPill></span>
                <span className="wf-mono" style={{ fontSize: 11, color: e.status === 'active' ? 'var(--ink3)' : 'var(--acc)' }}>{e.last}</span>
                <span className="wf-mono" style={{ fontSize: 11.5, fontWeight: 600 }}>{e.rate}</span>
              </div>
            ))}
          </div>

          <SecHead title="Entregas recentes" right={<span className="wf-chip" style={{ cursor: 'pointer', fontSize: 11 }}>Reenviar falhas</span>} />
          <div className="wf-card" style={{ overflow: 'hidden' }}>
            {deliveries.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderTop: i ? '1px solid var(--line2)' : 'none', fontSize: 12.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 9, background: d.ok ? 'var(--good)' : 'var(--acc)', flexShrink: 0 }} />
                <span className="wf-mono" style={{ flex: 1, color: 'var(--ink2)' }}>{d.ev}</span>
                <span className="wf-mono" style={{ fontSize: 11.5, fontWeight: 600, color: d.ok ? 'var(--good)' : 'var(--acc)' }}>{d.code}</span>
                <span className="wf-mono" style={{ fontSize: 11, color: 'var(--ink3)', width: 70, textAlign: 'right' }}>{d.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ SSO & ACESSO ============
function Sso({ go }) {
  const { Head, Back, SecHead, KpiRow, Toggle } = window.AdminProposalShell;
  const providers = [
    { name: 'Google Workspace', on: true, users: 218, mk: 'G' },
    { name: 'Microsoft Entra ID', on: true, users: 124, mk: 'M' },
    { name: 'Okta', on: false, users: 0, mk: 'O' },
    { name: 'SAML 2.0 genérico', on: false, users: 0, mk: 'S' },
  ];
  return (
    <>
      <Head title="SSO & acesso" sub="Login único e políticas de sessão"
        actions={<span className="wf-btn pri">Salvar</span>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <Back go={go} />
          <KpiRow items={[
            { value: '2', label: 'Provedores ativos' },
            { value: '92%', label: 'Login via SSO' },
            { value: '186', label: 'Sessões ativas' },
            { value: '1', label: 'Domínio verificado' },
          ]} />

          <SecHead title="Provedores de identidade" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {providers.map((p) => (
              <div key={p.name} className="wf-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: p.on ? 'var(--ink)' : 'var(--panel2)', color: p.on ? '#fff' : 'var(--ink3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{p.mk}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{p.on ? `${p.users} usuários conectados` : 'Não configurado'}</div>
                </div>
                <Toggle on={p.on} />
              </div>
            ))}
          </div>

          <SecHead title="Domínios permitidos" />
          <div className="wf-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="wf-chip" style={{ fontSize: 12, padding: '6px 11px' }}>acme.com <span style={{ color: 'var(--good)' }}>✓ verificado</span></span>
              <span className="wf-chip" style={{ fontSize: 12, padding: '6px 11px', borderStyle: 'dashed', color: 'var(--ink3)', cursor: 'pointer' }}>+ Adicionar domínio</span>
            </div>
          </div>

          <SecHead title="Política de sessão" />
          <div className="wf-card">
            {[['Exigir MFA para todos', 'Bloqueia login sem segundo fator', true], ['Timeout de sessão', 'Encerra após 8 h de inatividade', true], ['Restringir por faixa de IP', 'Apenas redes corporativas aprovadas', false], ['Forçar reautenticação em ações críticas', 'Exports, exclusões e mudança de papéis', true]].map((r, i) => (
              <div key={r[0]} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', borderTop: i ? '1px solid var(--line2)' : 'none' }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 560 }}>{r[0]}</div><div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{r[1]}</div></div>
                <Toggle on={r[2]} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ WHITE-LABEL ============
function Branding({ go }) {
  const { Head, Back, SecHead } = window.AdminProposalShell;
  const [color, setColor] = useStateC('#bf5b3d');
  const palette = ['#bf5b3d', '#1c1b19', '#2f6f4e', '#2b5d8a', '#7a4ea3', '#b0852f'];
  return (
    <>
      <Head title="White-label" sub="Personalização da marca para o workspace"
        actions={<span className="wf-btn pri">Publicar</span>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <Back go={go} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
            <div>
              <SecHead title="Identidade visual" />
              <div className="wf-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Logotipo</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <window.WF.Slot label="Logo claro · SVG" style={{ flex: 1, height: 72 }} />
                  <window.WF.Slot label="Logo escuro · SVG" style={{ flex: 1, height: 72 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, margin: '18px 0 10px' }}>Cor primária</div>
                <div style={{ display: 'flex', gap: 9 }}>
                  {palette.map((c) => (
                    <span key={c} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: 8, background: c, cursor: 'pointer', boxShadow: color === c ? '0 0 0 2px #fff, 0 0 0 4px var(--ink)' : 'inset 0 0 0 1px rgba(0,0,0,0.1)' }} />
                  ))}
                </div>
              </div>

              <SecHead title="Domínio personalizado" />
              <div className="wf-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code className="wf-mono" style={{ flex: 1, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5 }}>chat.acme.com</code>
                  <span className="wf-pill good" style={{ padding: '5px 11px' }}>✓ SSL ativo</span>
                </div>
              </div>

              <SecHead title="E-mail remetente" />
              <div className="wf-card" style={{ padding: 16 }}>
                <code className="wf-mono" style={{ display: 'block', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5 }}>Acme IA &lt;ia@acme.com&gt;</code>
              </div>
            </div>

            {/* live preview */}
            <div>
              <SecHead title="Pré-visualização" />
              <div className="wf-card" style={{ overflow: 'hidden', position: 'sticky', top: 0 }}>
                <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>A</span>
                  <b style={{ fontSize: 13 }}>Acme IA</b>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ alignSelf: 'flex-end', background: color, color: '#fff', borderRadius: '12px 12px 3px 12px', padding: '8px 12px', fontSize: 12.5, maxWidth: '80%' }}>Como faço para emitir a 2ª via?</div>
                  <div style={{ alignSelf: 'flex-start', background: 'var(--panel2)', borderRadius: '12px 12px 12px 3px', padding: '8px 12px', fontSize: 12.5, maxWidth: '85%' }}>Claro! Você pode emitir pelo portal em…</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', marginTop: 4 }}>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--ink3)' }}>Pergunte algo…</span>
                    <span style={{ width: 26, height: 26, borderRadius: 7, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CIcon name="send" size={14} color="#fff" /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { AdminProposalUsage: Usage, AdminProposalKeys: Keys, AdminProposalWebhooks: Webhooks, AdminProposalSso: Sso, AdminProposalBranding: Branding });
