// admin-proposal-screens-b.jsx — Modelos & LoRA, Auditoria, Compliance LGPD, Retenção
const BIcon = window.WF.Icon;
const BAIcon = window.WF.AdminIcon;
const { useState: useStateB } = React;

// ============ MODELOS & LoRA (MLOps) ============
function Models({ go }) {
  const { Head, Back, SecHead, KpiRow, StatusPill } = window.AdminProposalShell;
  const [active, setActive] = useStateB('v2026.04.1');
  const adapters = [
    { v: 'v2026.05.3', base: 'Llama 3.3 70B', task: 'Atendimento PT-BR', acc: 94.2, delta: '+2,4%', size: '184 MB', date: '28/05', status: 'staged' },
    { v: 'v2026.04.1', base: 'Llama 3.3 70B', task: 'Atendimento PT-BR', acc: 91.8, delta: '—', size: '180 MB', date: '12/04', status: 'active' },
    { v: 'v2026.03.2', base: 'Llama 3.3 70B', task: 'Jurídico', acc: 89.1, delta: '', size: '176 MB', date: '20/03', status: 'archived' },
    { v: 'v2026.02.0', base: 'Llama 3.1 8B', task: 'Classificação', acc: 86.5, delta: '', size: '64 MB', date: '08/02', status: 'archived' },
  ];
  const sm = { active: ['Ativo', 'ok'], staged: ['Em teste', 'warn'], archived: ['Arquivado', ''] };

  return (
    <>
      <Head title="Modelos & LoRA" sub="Inferência self-hosted · vLLM · A100 80GB"
        actions={<><span className="wf-btn gho"><BAIcon name="refresh" size={14} />Recarregar</span><span className="wf-btn pri"><BIcon name="upload" size={14} color="#fff" />Subir adapter</span></>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <Back go={go} />
          <KpiRow items={[
            { value: 'Llama 3.3 70B', label: 'Modelo base' },
            { value: '128 tok/s', label: 'Throughput', trend: 'p50', },
            { value: '73%', label: 'GPU util', trend: 'A100', warn: true },
            { value: '4', label: 'Adapters LoRA' },
          ]} />

          {/* active model card */}
          <SecHead title="Modelo em produção" />
          <div className="wf-card" style={{ padding: 18, display: 'flex', gap: 22, alignItems: 'center' }}>
            <span style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BAIcon name="cpu" size={24} color="var(--ink2)" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>Llama 3.3 70B Instruct</span>
                <StatusPill kind="ok">Online</StatusPill>
                <span className="wf-chip" style={{ fontSize: 11 }}>LoRA v2026.04.1</span>
              </div>
              <div style={{ display: 'flex', gap: 26, marginTop: 12 }}>
                {[['Quantização', 'AWQ 4-bit'], ['Contexto', '32k tokens'], ['Latência p50', '240 ms'], ['Réplicas', '2 / 2']].map((s) => (
                  <div key={s[0]}><div style={{ fontSize: 11, color: 'var(--ink3)' }}>{s[0]}</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{s[1]}</div></div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}><window.Gauge value={73} sub="GPU" color="var(--acc)" size={92} /></div>
          </div>

          {/* adapters table */}
          <SecHead title="Adapters LoRA" note="hot-swap sem downtime" right={<span className="wf-pill" style={{ cursor: 'default' }}>Todas as tarefas<BIcon name="chevron" size={12} color="#9a958d" /></span>} />
          <div className="wf-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 90px 96px 80px 70px 120px', padding: '10px 16px', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
              <span>Versão</span><span>Tarefa</span><span>Acurácia</span><span>vs. ativo</span><span>Tamanho</span><span>Status</span><span></span>
            </div>
            {adapters.map((a) => (
              <div key={a.v} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr 90px 96px 80px 70px 120px', padding: '12px 16px', alignItems: 'center', fontSize: 12.5, borderTop: '1px solid var(--line2)' }}>
                <span className="wf-mono" style={{ fontWeight: 600 }}>{a.v}</span>
                <span style={{ color: 'var(--ink2)' }}>{a.task}<div style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{a.base}</div></span>
                <span style={{ fontWeight: 600 }}>{a.acc}%</span>
                <span className="wf-mono" style={{ fontSize: 11.5, color: a.delta.startsWith('+') ? 'var(--good)' : 'var(--ink3)' }}>{a.delta}</span>
                <span className="wf-mono" style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{a.size}</span>
                <span><StatusPill kind={sm[a.status][1]}>{sm[a.status][0]}</StatusPill></span>
                <span>{a.status === 'staged' ? <span className="wf-btn acc" style={{ padding: '6px 11px', fontSize: 11.5, cursor: 'pointer' }}>Promover</span> : a.status === 'archived' ? <span className="wf-chip" style={{ fontSize: 11, cursor: 'pointer' }}>Restaurar</span> : <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>Em produção</span>}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ AUDITORIA ============
function Audit({ go }) {
  const { Head, Back, KpiRow } = window.AdminProposalShell;
  const [sev, setSev] = useStateB('all');
  const events = [
    { t: '09:31', d: 'Hoje', sev: 'info', actor: 'Mariana Alves', act: 'Login via Google SSO', ip: '187.4.12.9', meta: 'Chrome · São Paulo' },
    { t: '09:12', d: 'Hoje', sev: 'warning', actor: 'Sistema', act: '3 tentativas de login falhas', ip: '45.231.x.x', meta: 'conta: bruno@acme.com' },
    { t: '08:40', d: 'Hoje', sev: 'critical', actor: 'Rafael Costa', act: 'Exportou 1.204 conversas', ip: '187.4.12.3', meta: 'projeto Jurídico · CSV' },
    { t: '17:22', d: 'Ontem', sev: 'info', actor: 'Helena Marques', act: 'Promoveu LoRA v2026.04.1', ip: '187.4.12.1', meta: 'modelo em produção' },
    { t: '16:05', d: 'Ontem', sev: 'warning', actor: 'Helena Marques', act: 'Alterou política de retenção', ip: '187.4.12.1', meta: 'conversas: 180 → 90 dias' },
    { t: '14:48', d: 'Ontem', sev: 'critical', actor: 'Helena Marques', act: 'Suspendeu usuário', ip: '187.4.12.1', meta: 'carla@acme.com' },
    { t: '11:02', d: 'Ontem', sev: 'info', actor: 'Bruno Lima', act: 'Criou API key', ip: '187.4.12.7', meta: 'escopo: read-only' },
  ];
  const filtered = sev === 'all' ? events : events.filter((e) => e.sev === sev);
  const sevMap = { info: ['var(--ink3)', 'Info'], warning: ['#c08a2e', 'Atenção'], critical: ['var(--acc)', 'Crítico'] };

  return (
    <>
      <Head title="Auditoria" sub="Trilha imutável de eventos · retida por 365 dias"
        actions={<><span className="wf-pill" style={{ cursor: 'default' }}>Últimos 7 dias<BIcon name="chevron" size={12} color="#9a958d" /></span><span className="wf-btn gho"><BAIcon name="download" size={14} />Exportar log</span></>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Back go={go} />
          <KpiRow items={[
            { value: '1.204', label: 'Eventos · 7d' },
            { value: '12', label: 'Logins falhos', trend: '↑ 4', warn: true },
            { value: '3', label: 'Exports de dados' },
            { value: '2', label: 'Eventos críticos', warn: true },
          ]} />

          {/* severity filter */}
          <div style={{ display: 'flex', gap: 8, margin: '20px 0 14px', alignItems: 'center' }}>
            {[['all', 'Todos'], ['critical', 'Crítico'], ['warning', 'Atenção'], ['info', 'Info']].map(([id, l]) => (
              <span key={id} onClick={() => setSev(id)} className="wf-chip" style={{ cursor: 'pointer', fontSize: 12, padding: '5px 11px', ...(sev === id ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : {}) }}>{l}</span>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink3)' }}>{filtered.length} eventos</span>
          </div>

          {/* event list */}
          <div className="wf-card" style={{ overflow: 'hidden' }}>
            {filtered.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '13px 16px', borderTop: i ? '1px solid var(--line2)' : 'none', alignItems: 'center' }}>
                <span style={{ width: 9, height: 9, borderRadius: 9, background: sevMap[e.sev][0], flexShrink: 0 }} />
                <span style={{ width: 64, flexShrink: 0 }}><div className="wf-mono" style={{ fontSize: 12, fontWeight: 600 }}>{e.t}</div><div style={{ fontSize: 10, color: 'var(--ink3)' }}>{e.d}</div></span>
                <span className="wf-av" style={{ width: 26, height: 26, fontSize: 10, flexShrink: 0 }}>{e.actor.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 560 }}>{e.act}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{e.actor} · {e.meta}</div>
                </div>
                <span className="wf-mono" style={{ fontSize: 11, color: 'var(--ink3)', flexShrink: 0 }}>{e.ip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ COMPLIANCE LGPD ============
function Compliance({ go }) {
  const { Head, Back, SecHead } = window.AdminProposalShell;
  const controls = [
    { name: 'Autenticação multifator (MFA)', status: 'partial', note: '91% dos usuários · alvo 100%' },
    { name: 'Criptografia em repouso e trânsito', status: 'ok', note: 'AES-256 · TLS 1.3' },
    { name: 'Trilha de auditoria imutável', status: 'ok', note: 'retida 365 dias' },
    { name: 'Política de retenção definida', status: 'ok', note: 'conversas 90d · logs 365d' },
    { name: 'Acordo de tratamento (DPA)', status: 'ok', note: 'assinado · 12/01/2025' },
    { name: 'Residência de dados no Brasil', status: 'ok', note: 'região sa-east-1' },
    { name: 'Encarregado (DPO) designado', status: 'pending', note: 'pendente de nomeação' },
  ];
  const dsar = [
    { who: 'cliente#48213', type: 'Exclusão', due: '02/06', status: 'pending' },
    { who: 'cliente#47009', type: 'Exportação', due: '04/06', status: 'progress' },
    { who: 'cliente#46551', type: 'Exclusão', due: '28/05', status: 'done' },
  ];
  const cm = { ok: ['var(--good)', '✓'], partial: ['#c08a2e', '!'], pending: ['var(--acc)', '○'] };
  const dm = { pending: ['Pendente', 'acc'], progress: ['Em andamento', ''], done: ['Concluído', 'good'] };

  return (
    <>
      <Head title="Compliance LGPD" sub="Lei Geral de Proteção de Dados · revisado mensalmente"
        actions={<span className="wf-btn gho"><BAIcon name="download" size={14} />Relatório PDF</span>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Back go={go} />
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14 }}>
            {/* score card */}
            <div className="wf-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <window.Gauge value={92} sub="conforme" color="var(--good)" size={150} />
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>Score de conformidade</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', textAlign: 'center', marginTop: 4 }}>2 itens precisam de atenção</div>
            </div>
            {/* controls */}
            <div className="wf-card" style={{ overflow: 'hidden' }}>
              {controls.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px', borderTop: i ? '1px solid var(--line2)' : 'none' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', background: cm[c.status][0] }}>{cm[c.status][1]}</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 560 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--ink3)' }}>{c.note}</div></div>
                  {c.status !== 'ok' && <span className="wf-chip" style={{ fontSize: 11, cursor: 'pointer', color: 'var(--acc)', borderColor: 'var(--acc-line)' }}>Resolver</span>}
                </div>
              ))}
            </div>
          </div>

          {/* DSAR requests */}
          <SecHead title="Solicitações de titulares (DSAR)" note="prazo legal de 15 dias" />
          <div className="wf-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 130px', padding: '10px 16px', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
              <span>Titular</span><span>Tipo</span><span>Prazo</span><span></span>
            </div>
            {dsar.map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 130px', padding: '12px 16px', alignItems: 'center', fontSize: 12.5, borderTop: '1px solid var(--line2)' }}>
                <span className="wf-mono" style={{ fontWeight: 600 }}>{d.who}</span>
                <span style={{ color: 'var(--ink2)' }}>{d.type}</span>
                <span className="wf-mono" style={{ fontSize: 11.5, color: d.status === 'pending' ? 'var(--acc)' : 'var(--ink3)' }}>{d.due}</span>
                <span><span className={'wf-pill ' + dm[d.status][1]} style={{ padding: '2px 9px', fontSize: 10.5 }}>{dm[d.status][0]}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ RETENÇÃO DE DADOS ============
function Retention({ go }) {
  const { Head, Back, SecHead, Toggle } = window.AdminProposalShell;
  const [policies, setPolicies] = useStateB([
    { type: 'Conversas & mensagens', days: 90, icon: 'chat', auto: true, size: '142 GB' },
    { type: 'Logs de auditoria', days: 365, icon: 'scroll', auto: true, size: '38 GB', locked: true },
    { type: 'Anexos & arquivos', days: 180, icon: 'file', auto: true, size: '210 GB' },
    { type: 'Embeddings (RAG)', days: 0, icon: 'dna', auto: false, size: '64 GB' },
  ]);
  const opts = [0, 30, 90, 180, 365];
  const setDays = (i, d) => setPolicies((p) => p.map((x, j) => j === i ? { ...x, days: d } : x));

  return (
    <>
      <Head title="Retenção de dados" sub="Ciclo de vida e exclusão automática por tipo de dado"
        actions={<span className="wf-btn pri">Salvar políticas</span>} />
      <div className="wf-body" style={{ padding: '20px 28px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Back go={go} />
          <div className="wf-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 11, background: 'var(--panel)', marginBottom: 18 }}>
            <BAIcon name="alert" size={16} color="#9a958d" />
            <div style={{ fontSize: 12, color: 'var(--ink2)' }}>A exclusão automática é irreversível e registrada na auditoria. Logs de auditoria têm retenção mínima legal de 365 dias.</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {policies.map((p, i) => (
              <div key={p.type} className="wf-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--panel2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BAIcon name={p.icon} size={18} color="var(--ink2)" /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.type}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{p.size} armazenados{p.locked && ' · mínimo legal'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--ink2)' }}>Exclusão automática<Toggle on={p.auto} /></div>
                </div>
                <div style={{ display: 'flex', gap: 7, marginTop: 14, paddingLeft: 51 }}>
                  {opts.map((d) => (
                    <span key={d} onClick={() => !p.locked && setDays(i, d)} className="wf-chip"
                      style={{ cursor: p.locked ? 'not-allowed' : 'pointer', fontSize: 12, padding: '6px 12px', opacity: p.locked && d !== p.days ? 0.4 : 1, ...(p.days === d ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : {}) }}>
                      {d === 0 ? 'Manter' : d + ' dias'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { AdminProposalModels: Models, AdminProposalAudit: Audit, AdminProposalCompliance: Compliance, AdminProposalRetention: Retention });
