// wf-kit.jsx — shared minimalist wireframe primitives for ChatCorp screens
// Exports to window.WF. Monochrome ink + single terracotta accent for
// interactive/active states and ✦ innovation markers.

(function () {
  if (typeof document !== 'undefined' && !document.getElementById('wf-kit-styles')) {
    const s = document.createElement('style');
    s.id = 'wf-kit-styles';
    s.textContent = `
      .wf{ --ink:#1c1b19; --ink2:#5f5c57; --ink3:#9a958d; --line:#e7e4df;
           --line2:#f0eeea; --panel:#fafafa; --panel2:#f4f2ee; --white:#fff;
           --acc:#bf5b3d; --acc-soft:#f8ece6; --acc-line:#e7c3b4;
           --good:#3f7d62; --good-soft:#eaf2ee;
           font-family:"IBM Plex Sans",system-ui,sans-serif; color:var(--ink);
           height:100%; display:flex; background:var(--white); }
      .wf *{ box-sizing:border-box; }
      .wf-mono{ font-family:"IBM Plex Mono",ui-monospace,monospace; }
      /* sidebar */
      .wf-side{ width:240px; flex-shrink:0; background:var(--panel); border-right:1px solid var(--line);
                display:flex; flex-direction:column; padding:18px 14px; gap:4px; }
      .wf-brand{ display:flex; align-items:center; gap:10px; padding:4px 8px 14px; }
      .wf-brand .mk{ width:26px; height:26px; border-radius:7px; background:var(--ink); color:#fff;
                     display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
      .wf-brand b{ font-size:15px; font-weight:600; letter-spacing:-.01em; }
      .wf-search{ display:flex; align-items:center; gap:8px; border:1px solid var(--line); background:#fff;
                  border-radius:9px; padding:8px 10px; color:var(--ink3); font-size:13px; margin-bottom:10px; }
      .wf-search .kbd{ margin-left:auto; font-size:10.5px; border:1px solid var(--line); border-radius:5px;
                       padding:1px 5px; color:var(--ink3); }
      .wf-nav{ display:flex; flex-direction:column; gap:1px; }
      .wf-navi{ display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px;
                font-size:13.5px; color:var(--ink2); }
      .wf-navi.on{ background:#fff; color:var(--ink); box-shadow:inset 0 0 0 1px var(--line); font-weight:560; }
      .wf-navi .ic{ color:var(--ink3); } .wf-navi.on .ic{ color:var(--acc); }
      .wf-seclbl{ font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink3);
                  padding:14px 10px 6px; font-weight:600; }
      .wf-user{ margin-top:auto; display:flex; align-items:center; gap:10px; padding:8px; border-top:1px solid var(--line); }
      /* main */
      .wf-main{ flex:1; min-width:0; display:flex; flex-direction:column; }
      .wf-top{ height:56px; flex-shrink:0; border-bottom:1px solid var(--line); display:flex; align-items:center;
               gap:12px; padding:0 22px; }
      .wf-title{ font-size:15px; font-weight:600; }
      .wf-body{ flex:1; min-height:0; overflow:hidden; }
      /* generic */
      .wf-pill{ display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background:#fff;
                border-radius:999px; padding:5px 11px; font-size:12px; color:var(--ink2); }
      .wf-pill.acc{ border-color:var(--acc-line); background:var(--acc-soft); color:var(--acc); }
      .wf-pill.good{ border-color:#cfe1d7; background:var(--good-soft); color:var(--good); }
      .wf-btn{ display:inline-flex; align-items:center; gap:7px; border:none; border-radius:9px; padding:9px 15px;
               font-size:13px; font-weight:560; font-family:inherit; cursor:default; }
      .wf-btn.pri{ background:var(--ink); color:#fff; } .wf-btn.gho{ background:#fff; color:var(--ink); box-shadow:inset 0 0 0 1px var(--line); }
      .wf-btn.acc{ background:var(--acc); color:#fff; }
      .wf-chip{ display:inline-flex; align-items:center; gap:5px; border:1px solid var(--line); border-radius:7px;
                padding:4px 9px; font-size:11.5px; color:var(--ink2); background:#fff; }
      .wf-av{ border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
              font-size:11px; font-weight:600; background:var(--panel2); color:var(--ink2); box-shadow:inset 0 0 0 1px var(--line); }
      .wf-card{ border:1px solid var(--line); border-radius:12px; background:#fff; }
      .wf-bar{ height:9px; border-radius:5px; background:var(--line2); }
      .wf-nov{ display:inline-flex; align-items:center; gap:5px; font-family:"IBM Plex Mono",monospace;
               font-size:10.5px; letter-spacing:.02em; color:var(--acc); background:var(--acc-soft);
               border:1px solid var(--acc-line); border-radius:6px; padding:2px 7px; }
      .wf-slot{ display:flex; align-items:center; justify-content:center; border:1px dashed var(--ink3);
                border-radius:8px; color:var(--ink3);
                background:repeating-linear-gradient(135deg,#f4f2ee,#f4f2ee 7px,#faf9f6 7px,#faf9f6 14px);
                font-family:"IBM Plex Mono",monospace; font-size:11px; }
      .wf-foc{ box-shadow:0 0 0 2px var(--acc-soft), 0 0 0 3px var(--acc); border-radius:9px; }
    `;
    document.head.appendChild(s);
  }

  // Minimal line icons (simple geometry only)
  const P = {
    chat:   'M3 4h14v9H8l-3 3v-3H3z',
    doc:    'M5 2h7l4 4v12H5z M12 2v4h4',
    brain:  'M7 4a3 3 0 0 0 0 6 M13 4a3 3 0 0 1 0 6 M7 10a3 3 0 0 0 0 6 M13 10a3 3 0 0 1 0 6 M10 4v12',
    gear:   'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M10 1v3 M10 16v3 M1 10h3 M16 10h3 M4 4l2 2 M14 14l2 2 M16 4l-2 2 M6 14l-2 2',
    folder: 'M2 5h6l2 2h8v9H2z',
    search: 'M9 3a6 6 0 1 0 0 12A6 6 0 0 0 9 3 M14 14l4 4',
    plus:   'M10 4v12 M4 10h12',
    send:   'M3 10l14-6-6 14-2-6z',
    stop:   'M5 5h10v10H5z',
    sources:'M4 3h9l3 3v11H4z M11 9h3 M6 9h3 M6 12h8',
    user:   'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M4 17a6 6 0 0 1 12 0',
    shield: 'M10 2l7 3v5c0 5-3.5 7.5-7 8.5C6.5 17.5 3 15 3 10V5z',
    check:  'M4 10l4 4 8-9',
    upload: 'M10 14V4 M6 8l4-4 4 4 M4 16h12',
    bolt:   'M11 2L4 11h5l-1 7 7-9h-5z',
    sliders:'M3 6h9 M15 6h2 M3 14h2 M8 14h9 M12 4v4 M5 12v4',
    chevron:'M5 8l5 5 5-5',
    arrow:  'M4 10h12 M11 5l5 5-5 5',
    key:    'M13 3a4 4 0 1 0 2 7l3 3-2 2-1-1-1 1-1-1-1 1-2-2 3-3a4 4 0 0 1 1-6z',
  };
  function Icon({ name, size = 17, stroke = 1.6, color = 'currentColor', style }) {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, ...style }}>
        <path d={P[name] || ''} />
      </svg>
    );
  }

  function Slot({ label, style }) {
    return <div className="wf-slot" style={style}>{label}</div>;
  }
  function Nov({ children }) {
    return <span className="wf-nov">✦ {children}</span>;
  }
  function Av({ children, size = 28 }) {
    return <span className="wf-av" style={{ width: size, height: size, fontSize: size * 0.4 }}>{children}</span>;
  }
  function Bar({ w = '100%', h = 9, style }) {
    return <div className="wf-bar" style={{ width: w, height: h, ...style }} />;
  }

  window.WF = { Icon, Slot, Nov, Av, Bar };
})();
