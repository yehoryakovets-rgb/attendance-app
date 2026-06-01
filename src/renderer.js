// ── CONSTANTS ────────────────────────────────────────────────────────
const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const D3    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// Day name → JavaScript getDay() number (Sunday = 0 ... Saturday = 6).
const DOW   = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
// Short label indexed by getDay() (for the sheet's date headers).
const DOW3  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── STATE ────────────────────────────────────────────────────────────
let db         = { classes: [] };
let view       = 'home';
let activeId   = null;
let activeTab  = 'settings';
let saveTimer  = null;
let autoTimer  = null;

// ── BOOT ─────────────────────────────────────────────────────────────
async function boot() {
  applyZoom();
  const saved = await window.api.loadData();
  if (saved) db = saved;
  // Open a class when a .am file is double-clicked (or opened) on macOS.
  window.api.onOpenAm(({ cls, path }) => importAmClass(cls, path));
  render();
  updateDate();
  setInterval(updateDate, 60 * 1000); // keep it correct if the app is left open past midnight
}

// ── UI ZOOM (accessibility) ──────────────────────────────────────────
let uiZoom = parseFloat(localStorage.getItem('uiZoom')) || 1;
function applyZoom() {
  uiZoom = Math.min(1.8, Math.max(1, Math.round(uiZoom * 10) / 10));
  document.documentElement.style.zoom = uiZoom;
  const el = document.getElementById('zoomval');
  if (el) el.textContent = Math.round(uiZoom * 100) + '%';
}
function setZoom(dir) {
  uiZoom = Math.min(1.8, Math.max(1, Math.round((uiZoom + dir * 0.1) * 10) / 10));
  localStorage.setItem('uiZoom', uiZoom);
  applyZoom();
}

function updateDate() {
  const el = document.getElementById('tbdate');
  if (el) el.textContent = '📅 ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ── PERSIST ──────────────────────────────────────────────────────────
async function save() {
  await window.api.saveData(db);
  // If the active class is linked to a .am file, keep that file up to date too.
  const cls = ac();
  if (cls && cls.amPath) window.api.writeAm(cls.amPath, cls);
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
  const res = [], idxs = days.map(d => DOW[d]);
  const cur = new Date(s + 'T12:00:00'), end = new Date(e + 'T12:00:00');
  while (cur <= end) {
    if (idxs.includes(cur.getDay())) res.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate() + 1);
  }
  return res;
}

// Today's date as YYYY-MM-DD, built the same way genDates builds session dates
// (local noon → ISO) so it matches a session column for the same calendar day.
function todayStr() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12).toISOString().slice(0, 10);
}

function fmtShort(ds) {
  const d = new Date(ds + 'T12:00:00');
  return MONS[d.getMonth()] + ' ' + d.getDate();
}
function fmtHead(ds) {
  const d = new Date(ds + 'T12:00:00');
  return `<span class="dh-dow">${DOW3[d.getDay()]}</span>`
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
    if (activeTab === 'sheet') setTimeout(scrollToToday, 60);
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
      <div>
        <h1>My Classes</h1>
        <p>${db.classes.length} class${db.classes.length !== 1 ? 'es' : ''}</p>
      </div>
      <button class="btn btn-outline btn-sm" onclick="openAmFile()" title="Open a class saved as a .am file">Open .am file</button>
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

function openCls(id) {
  activeId = id; view = 'editor';
  // If the class is already set up (has students and scheduled sessions), jump
  // straight to the Sheet. Otherwise start on Settings to finish setup.
  const cls = getCls(id);
  const ready = cls && cls.students?.length && genDates(cls.startDate, cls.endDate, cls.meetingDays).length;
  activeTab = ready ? 'sheet' : 'settings';
  render();
}

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
        <button class="btn btn-outline btn-sm" onclick="saveAsAm()" title="Save this class as a .am file you can keep in a folder">Save as .am</button>
        <button class="btn btn-outline btn-sm" onclick="doExport(true)" title="Pick a different folder for exports">Change folder</button>
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
      <input class="s-edit s-edit-name" value="${h(s.name)}" title="Edit name"
             onchange="editStu('${s.id}','name',this.value)">
      <input class="s-edit s-edit-id" value="${h(s.studentId || '')}" placeholder="Student ID" title="Edit student ID"
             onchange="editStu('${s.id}','studentId',this.value)">
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

// Edit a student's name or ID in place (no add/delete needed).
function editStu(sid, field, value) {
  const cls = ac(); if (!cls) return;
  const s = cls.students.find(x => x.id === sid); if (!s) return;
  const v = value.trim();
  if (field === 'name' && !v) { render(); return; } // don't allow a blank name; restore previous
  s[field] = v;
  save();
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

  const today    = todayStr();
  const hasToday = dates.includes(today);
  const dh = dates.map(ds => `<th class="col-date-h${ds === today ? ' today' : ''}"${ds === today ? ' id="todaycol"' : ''}><div class="date-stack">${fmtHead(ds)}</div></th>`).join('');

  const rows = cls.students.map((s, si) => {
    const st  = stats(cls, s.id);
    const bad = st.abs > 0 || st.tardy > 0;
    const cells = dates.map(ds => {
      const v = cls.attendance?.[s.id]?.[ds] || '';
      return `<td class="col-att-td${ds === today ? ' today' : ''}"><button class="att-cell ${v}" onclick="cycleCell('${s.id}','${ds}',this)">${v || '·'}</button></td>`;
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
    <div class="sheet-bar-actions">
      ${hasToday ? `<button class="btn btn-outline btn-sm" onclick="scrollToToday()">Jump to Today</button>` : ''}
    </div>
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

function scrollToToday() {
  const el = document.getElementById('todaycol');
  if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
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
// choose=true forces the folder picker (used by "Change folder"); the new
// location is then remembered for future exports.
async function doExport(choose) {
  const cls = ac(); if (!cls) return;
  const success = await window.api.exportXlsx(cls, !!choose);
  if (success) toast(choose ? 'Export folder changed. File saved.' : 'Excel file saved successfully.');
}

// ── .am DOCUMENT FILES ───────────────────────────────────────────────
// Save the active class to a .am file the professor can keep in any folder.
async function saveAsAm() {
  const cls = ac(); if (!cls) return;
  const path = await window.api.saveAm(cls);
  if (path) { cls.amPath = path; save(); toast('Saved as .am file. It now updates as you edit.'); }
}

// Open a .am file via the file picker.
async function openAmFile() {
  const res = await window.api.openAm();
  if (res && res.cls) importAmClass(res.cls, res.path);
}

// Bring a class from a .am file into the app (add or update by id), link the
// file so future edits save back to it, and open it.
function importAmClass(cls, path) {
  if (!cls || !cls.id) return;
  cls.amPath = path;
  const i = db.classes.findIndex(c => c.id === cls.id);
  if (i >= 0) db.classes[i] = cls; else db.classes.push(cls);
  openCls(cls.id);
  save();
  toast('Opened "' + (cls.name || 'class') + '" from file.');
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
