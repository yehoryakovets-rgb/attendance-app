// ── CONSTANTS ────────────────────────────────────────────────────────
const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const D3    = ['Mon','Tue','Wed','Thu','Fri'];
const MONS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── STATE ────────────────────────────────────────────────────────────
let db         = { classes: [] };
let view       = 'home';
let activeId   = null;
let activeTab  = 'settings';
let saveTimer  = null;
let autoTimer  = null;

// ── BOOT ─────────────────────────────────────────────────────────────
async function boot() {
  const saved = await window.api.loadData();
  if (saved) db = saved;
  render();
  updateDate();
  setInterval(updateDate, 60 * 1000); // keep it correct if the app is left open past midnight
}

function updateDate() {
  const el = document.getElementById('tbdate');
  if (el) el.textContent = '📅 ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ── PERSIST ──────────────────────────────────────────────────────────
async function save() {
  await window.api.saveData(db);
  const el = document.getElementById('sb');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── UTILS ────────────────────────────────────────────────────────────
function uid()        { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function getCls(id)   { return db.classes.find(c => c.id === id); }
function ac()         { return getCls(activeId); }

function genDates(s, e, days) {
  if (!s || !e || !days?.length) return [];
  const res = [], idxs = days.map(d => DAYS.indexOf(d) + 1);
  const cur = new Date(s + 'T12:00:00'), end = new Date(e + 'T12:00:00');
  while (cur <= end) {
    if (idxs.includes(cur.getDay())) res.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate() + 1);
  }
  return res;
}

function fmtShort(ds) {
  const d = new Date(ds + 'T12:00:00');
  return MONS[d.getMonth()] + ' ' + d.getDate();
}
function fmtHead(ds) {
  const d = new Date(ds + 'T12:00:00');
  return `<span class="dh-dow">${D3[d.getDay()-1]}</span>`
       + `<span class="dh-mon">${MONS[d.getMonth()]}</span>`
       + `<span class="dh-day">${d.getDate()}</span>`;
}

function stats(cls, sid) {
  const dates = genDates(cls.startDate, cls.endDate, cls.meetingDays);
  let abs = 0, tardy = 0;
  for (const ds of dates) {
    const v = cls.attendance?.[sid]?.[ds] || '';
    if (v === 'A') abs++; else if (v === 'T') tardy++;
  }
  return { abs, tardy, pct: dates.length ? Math.round(((dates.length - abs) / dates.length) * 100) : 100, total: dates.length };
}

function h(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ── RENDER ───────────────────────────────────────────────────────────
function render() {
  const root  = document.getElementById('root');
  const crumb = document.getElementById('crumb');
  if (view === 'home') {
    crumb.innerHTML = '<span class="ca">All Classes</span>';
    root.innerHTML  = renderHome();
  } else {
    const cls = ac();
    crumb.innerHTML = `<span>All Classes</span> <span>/</span> <span class="ca">${h(cls?.name || 'Untitled')}</span>`;
    root.innerHTML  = renderEditor(cls);
  }
}

// ── HOME ─────────────────────────────────────────────────────────────
function renderHome() {
  const cards = db.classes.map(cls => {
    const dates = genDates(cls.startDate, cls.endDate, cls.meetingDays);
    const dstr  = (cls.meetingDays || []).map(d => D3[DAYS.indexOf(d)]).join(' · ');
    return `
    <div class="class-card" onclick="openCls('${cls.id}')">
      <button class="card-del" onclick="event.stopPropagation(); askDel('${cls.id}')" title="Delete class">×</button>
      <div class="class-card-name">${h(cls.name || 'Untitled Class')}</div>
      <div class="class-card-meta">
        ${cls.college    ? `<div><b>College</b> ${h(cls.college)}</div>`      : ''}
        ${cls.semester   ? `<div><b>Semester</b> ${h(cls.semester)}</div>`    : ''}
        ${cls.instructor ? `<div><b>Instructor</b> ${h(cls.instructor)}</div>` : ''}
        ${dstr           ? `<div><b>Meets</b> ${dstr}</div>`                   : ''}
      </div>
      <div class="class-card-footer">
        <span class="pill pill-green">${cls.students?.length || 0} students</span>
        <span class="pill pill-amber">${dates.length} sessions</span>
      </div>
    </div>`;
  }).join('');

  return `
  <div id="home">
    <div class="home-hero">
      <h1>My Classes</h1>
      <p>${db.classes.length} class${db.classes.length !== 1 ? 'es' : ''}</p>
    </div>
    <div class="classes-grid">
      ${cards}
      <div class="new-card" onclick="newCls()">
        <div class="new-card-icon">＋</div>
        <div>New Class</div>
      </div>
    </div>
  </div>`;
}

function newCls() {
  const cls = { id: uid(), name:'', college:'', semester:'', instructor:'', startDate:'', endDate:'', meetingDays:[], students:[], attendance:{} };
  db.classes.push(cls);
  save();
  activeId = cls.id; activeTab = 'settings'; view = 'editor';
  render();
}

function openCls(id) { activeId = id; activeTab = 'settings'; view = 'editor'; render(); }

function goHome() { collectSettings(); view = 'home'; activeId = null; render(); }

function askDel(id) {
  const cls = getCls(id);
  modal(
    'Delete Class',
    `<p>Delete <strong>${h(cls?.name || 'this class')}</strong>?<br><br>All attendance data will be permanently removed. This cannot be undone.</p>`,
    [
      { label: 'Cancel', cls: 'btn-outline', cb: closeModal },
      { label: 'Delete', cls: 'btn-danger',  cb: () => { db.classes = db.classes.filter(c => c.id !== id); save(); closeModal(); render(); toast('Class deleted.'); } }
    ]
  );
}

// ── EDITOR ───────────────────────────────────────────────────────────
function renderEditor(cls) {
  const tabs   = ['settings', 'roster', 'sheet'];
  const tabHtml = tabs.map(t =>
    `<button class="tab-btn${activeTab === t ? ' on' : ''}" onclick="swTab('${t}')">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`
  ).join('');
  const ico = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10"/></svg>`;
  let body = activeTab === 'settings' ? renderSettings(cls) : activeTab === 'roster' ? renderRoster(cls) : renderSheet(cls);

  return `
  <div id="editor">
    <div class="editor-nav">
      <button class="back-btn" onclick="goHome()">← Back</button>
      <div class="editor-cls-name" id="ecn">${h(cls?.name || 'Untitled Class')}${cls?.semester ? `<small>${h(cls.semester)}</small>` : ''}</div>
      <div class="tab-list">${tabHtml}</div>
      <div class="editor-toolbar">
        <button class="btn btn-outline btn-sm" onclick="doExport()">${ico} Export Excel</button>
      </div>
    </div>
    <div class="editor-content"><div class="editor-inner">${body}</div></div>
  </div>`;
}

function swTab(t) {
  if (activeTab === 'settings') collectSettings();
  activeTab = t;
  render();
  if (t === 'roster') setTimeout(() => document.getElementById('ni')?.focus(), 60);
}

// ── SETTINGS ─────────────────────────────────────────────────────────
function renderSettings(cls) {
  const dates = genDates(cls.startDate, cls.endDate, cls.meetingDays);
  const pills = DAYS.map((d, i) =>
    `<button class="day-pill${cls.meetingDays?.includes(d) ? ' on' : ''}" onclick="togDay('${d}')">${D3[i]}</button>`
  ).join('');

  return `
  <div class="settings-wrap">
    <div class="form-block">
      <label class="field-label">College</label>
      <input class="field-input" id="fco" value="${h(cls.college)}" placeholder="e.g. Brooklyn College" oninput="autoSave()">
    </div>
    <div class="form-block">
      <label class="field-label">Course Name</label>
      <input class="field-input" id="fn" value="${h(cls.name)}" placeholder="e.g. Introduction to Biology" oninput="autoSave()">
    </div>
    <div class="form-grid2">
      <div>
        <label class="field-label">Semester</label>
        <input class="field-input" id="fse" value="${h(cls.semester)}" placeholder="e.g. Fall 2025" oninput="autoSave()">
      </div>
      <div>
        <label class="field-label">Instructor</label>
        <input class="field-input" id="fi" value="${h(cls.instructor)}" placeholder="e.g. Prof. Smith" oninput="autoSave()">
      </div>
    </div>
    <div class="form-grid2">
      <div>
        <label class="field-label">Start Date</label>
        <input type="date" class="field-input" id="fd1" value="${h(cls.startDate)}" onchange="autoSave()">
      </div>
      <div>
        <label class="field-label">End Date</label>
        <input type="date" class="field-input" id="fd2" value="${h(cls.endDate)}" onchange="autoSave()">
      </div>
    </div>
    <div class="form-block">
      <label class="field-label">Meeting Days</label>
      <div class="days-row">${pills}</div>
    </div>
    ${dates.length ? `<div class="sessions-info">📅 ${dates.length} sessions · ${fmtShort(dates[0])} → ${fmtShort(dates[dates.length-1])}</div>` : ''}
    <div class="form-actions">
      <button class="btn btn-green" onclick="swTab('roster')">Next: Roster →</button>
    </div>

    <div class="danger-zone">
      <h3>Danger Zone</h3>
      <button class="btn btn-danger" onclick="askDel('${cls.id}')">Delete This Class</button>
    </div>
  </div>`;
}

function collectSettings() {
  const cls = ac(); if (!cls) return;
  const g = id => document.getElementById(id)?.value ?? null;
  if (g('fn') !== null) {
    cls.name = g('fn'); cls.college = g('fco'); cls.semester = g('fse'); cls.instructor = g('fi');
    cls.startDate = g('fd1'); cls.endDate = g('fd2');
  }
}

function autoSave() {
  collectSettings();
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    save();
    const el = document.getElementById('ecn'), cls = ac();
    if (el && cls) el.innerHTML = `${h(cls.name || 'Untitled Class')}${cls.semester ? `<small>${h(cls.semester)}</small>` : ''}`;
  }, 600);
}

function togDay(day) {
  collectSettings();
  const cls = ac(); if (!cls) return;
  cls.meetingDays = cls.meetingDays.includes(day)
    ? cls.meetingDays.filter(d => d !== day)
    : [...cls.meetingDays, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
  save(); render();
}

// ── ROSTER ───────────────────────────────────────────────────────────
function renderRoster(cls) {
  const rows = cls.students.map((s, i) => `
    <div class="student-item">
      <span class="s-num">${String(i+1).padStart(2,'0')}</span>
      <span class="s-name">${h(s.name)}</span>
      ${s.studentId ? `<span class="s-sid">${h(s.studentId)}</span>` : ''}
      <button class="s-del" onclick="delStu('${s.id}')" title="Remove">×</button>
    </div>`).join('');

  return `
  <div class="roster-wrap">
    <div class="add-row">
      <input class="field-input" id="ni" placeholder="Student full name" onkeydown="if(event.key==='Enter') document.getElementById('si').focus()">
      <input class="field-input s-id-input" id="si" placeholder="Student ID" onkeydown="if(event.key==='Enter') addStu()">
      <button class="btn btn-green" onclick="addStu()">Add</button>
    </div>
    ${cls.students.length
      ? `<div class="student-list">${rows}</div>
         <div style="margin-top:20px"><button class="btn btn-green" onclick="swTab('sheet')">Open Sheet →</button></div>`
      : `<p style="color:var(--text3);font-family:var(--mono);font-size:12px;padding:8px 0">No students yet — add one above.</p>`
    }
  </div>`;
}

function addStu() {
  const name = document.getElementById('ni')?.value.trim();
  const studentId = document.getElementById('si')?.value.trim() || '';
  if (!name) return;
  ac().students.push({ id: uid(), name, studentId });
  save(); render();
  setTimeout(() => document.getElementById('ni')?.focus(), 50);
}

function delStu(sid) {
  const cls = ac();
  cls.students = cls.students.filter(s => s.id !== sid);
  delete cls.attendance[sid];
  save(); render();
}

// ── SHEET ────────────────────────────────────────────────────────────
function renderSheet(cls) {
  const dates = genDates(cls.startDate, cls.endDate, cls.meetingDays);
  if (!cls.students.length || !dates.length) {
    const noS = !cls.students.length;
    return `<div class="empty-sheet">
      <h3>${noS ? 'No students added yet' : 'No sessions configured'}</h3>
      <p>${noS ? 'Go to Roster and add students first.' : 'Set meeting days and date range in Settings.'}</p>
      <div style="margin-top:16px">
        <button class="btn btn-outline" onclick="swTab('${noS ? 'roster' : 'settings'}')">${noS ? 'Go to Roster' : 'Go to Settings'}</button>
      </div>
    </div>`;
  }

  const ico = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px"><path d="M8 2v8M5 7l3 3 3-3M3 12h10"/></svg>`;
  const dh = dates.map(ds => `<th class="col-date-h"><div class="date-stack">${fmtHead(ds)}</div></th>`).join('');

  const rows = cls.students.map((s, si) => {
    const st  = stats(cls, s.id);
    const bad = st.abs > 0 || st.tardy > 0;
    const cells = dates.map(ds => {
      const v = cls.attendance?.[s.id]?.[ds] || '';
      return `<td class="col-att-td"><button class="att-cell ${v}" onclick="cycleCell('${s.id}','${ds}',this)">${v || '·'}</button></td>`;
    }).join('');
    const pc = st.pct < 80 ? 'vpl' : st.pct < 90 ? 'vpm' : 'vpok';
    return `<tr>
      <td class="col-name-td"><div class="name-inner"><span class="row-num">${String(si+1).padStart(2,'0')}</span><span class="name-text">${h(s.name)}${s.studentId ? `<span class="row-sid">${h(s.studentId)}</span>` : ''}</span></div></td>
      <td class="col-sum-td"><span class="sum-badge${bad ? ' bad' : ''}" id="sum-${s.id}">${st.abs}/${st.tardy}</span></td>
      ${cells}
      <td class="col-stat-td"><span class="${st.abs > 0 ? 'va' : 'vok'}" id="sa-${s.id}">${st.abs}</span></td>
      <td class="col-stat-td"><span class="${st.tardy > 0 ? 'vt' : 'vok'}" id="st-${s.id}">${st.tardy}</span></td>
      <td class="col-stat-td"><span class="${pc}" id="sp-${s.id}">${st.pct}%</span></td>
    </tr>`;
  }).join('');

  return `
  <div class="sheet-bar">
    <div class="legend">
      <span><span class="legend-dot" style="background:var(--red)"></span>Absent (A)</span>
      <span><span class="legend-dot" style="background:var(--amber)"></span>Tardy (T)</span>
      <span><span class="legend-dot" style="background:var(--border2)"></span>Present (·)</span>
      <span style="color:var(--border2)">— click to cycle</span>
    </div>
    <button class="btn btn-outline btn-sm" onclick="doExport()">${ico} Export Excel</button>
  </div>
  <div class="sheet-outer">
    <table>
      <thead><tr>
        <th class="col-name-h">Student</th>
        <th class="col-sum-h">Abs/T</th>
        ${dh}
        <th class="col-stat-h">Abs</th>
        <th class="col-stat-h">Tardy</th>
        <th class="col-stat-h">Att%</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function cycleCell(sid, ds, btn) {
  const cls = ac();
  if (!cls.attendance[sid]) cls.attendance[sid] = {};
  const cur  = cls.attendance[sid][ds] || '';
  const next = cur === '' ? 'A' : cur === 'A' ? 'T' : '';
  if (next === '') delete cls.attendance[sid][ds]; else cls.attendance[sid][ds] = next;
  save();
  btn.className = 'att-cell ' + next;
  btn.textContent = next || '·';
  const st  = stats(cls, sid);
  const bad = st.abs > 0 || st.tardy > 0;
  const pc  = st.pct < 80 ? 'vpl' : st.pct < 90 ? 'vpm' : 'vpok';
  const sm = document.getElementById('sum-' + sid); if (sm) { sm.textContent = st.abs + '/' + st.tardy; sm.className = 'sum-badge' + (bad ? ' bad' : ''); }
  const sa = document.getElementById('sa-'  + sid); if (sa) { sa.textContent = st.abs;   sa.className = st.abs   > 0 ? 'va'  : 'vok'; }
  const st2= document.getElementById('st-'  + sid); if (st2){ st2.textContent= st.tardy; st2.className= st.tardy > 0 ? 'vt'  : 'vok'; }
  const sp = document.getElementById('sp-'  + sid); if (sp) { sp.textContent = st.pct + '%'; sp.className = pc; }
}

// ── EXPORT XLSX ──────────────────────────────────────────────────────
async function doExport() {
  const cls = ac(); if (!cls) return;
  const success = await window.api.exportXlsx(cls);
  if (success) toast('Excel file saved successfully.');
}

// ── MODAL ────────────────────────────────────────────────────────────
function modal(title, body, btns) {
  const bh = btns.map((b,i) => `<button class="btn ${b.cls}" id="mb${i}">${b.label}</button>`).join('');
  const div = document.createElement('div');
  div.className = 'modal-bg'; div.id = 'modal-bg';
  div.innerHTML = `<div class="modal"><h2>${h(title)}</h2>${body}<div class="modal-footer">${bh}</div></div>`;
  div.addEventListener('click', e => { if (e.target === div) closeModal(); });
  document.body.appendChild(div);
  btns.forEach((b,i) => document.getElementById('mb'+i)?.addEventListener('click', b.cb));
}
function closeModal() { document.getElementById('modal-bg')?.remove(); }

// ── GO ───────────────────────────────────────────────────────────────
boot();
