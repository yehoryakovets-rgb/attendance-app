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
// Register the .am open-file listener IMMEDIATELY (before any await) so a
// cold-launch double-click isn't missed. If data isn't loaded yet, buffer it.
let amReady = false, amQueued = null;
function handleOpenAm(data) {
  if (!data || !data.cls) return;
  if (!amReady) { amQueued = data; return; }  // arrived before data finished loading
  importAmClass(data.cls, data.path);
}
window.api.onOpenAm(handleOpenAm);

async function boot() {
  applyZoom();
  applyTheme();
  document.addEventListener('click', closeAccentMenu); // click anywhere else closes the menu
  const saved = await window.api.loadData();
  if (saved) db = saved;
  render();
  updateDate();
  setInterval(updateDate, 60 * 1000); // keep it correct if the app is left open past midnight
  window.addEventListener('resize', () => { if (view === 'editor' && activeTab === 'sheet') syncFrozen(); });
  try {
    const v = await window.api.getVersion();
    const el = document.getElementById('verlabel');
    if (el && v) el.textContent = 'v' + v;
  } catch (e) {}
  amReady = true;
  if (amQueued) { const q = amQueued; amQueued = null; handleOpenAm(q); } // warm push that arrived during boot
  // Cold launch / window-less: pull any .am file queued during startup.
  try {
    const p = await window.api.getPendingAm();
    if (p && p.cls) importAmClass(p.cls, p.path);
  } catch (e) {}
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

// ── ACCENT COLOR THEMES ──────────────────────────────────────────────
// accent/d/l/l2 = light mode; dk = brighter accent for dark mode; rgb is used
// to build subtle tints over the dark background.
const ACCENTS = {
  turquoise: { name: 'Turquoise', accent: '#0f9b9b', d: '#0b7575', l: '#e6f5f5', l2: '#c2e8e8', dk: '#16abab', rgb: '15,155,155' },
  blue:      { name: 'Blue',      accent: '#2b6cb0', d: '#1f4f83', l: '#e9f1fa', l2: '#cfe1f4', dk: '#3f80c4', rgb: '43,108,176' },
  purple:    { name: 'Purple',    accent: '#7048b6', d: '#523487', l: '#f0ebfa', l2: '#ddd0f0', dk: '#875fce', rgb: '112,72,182' },
  green:     { name: 'Green',     accent: '#3b6b4a', d: '#2a4e36', l: '#eaf2ec', l2: '#d4e8d8', dk: '#4d8560', rgb: '59,107,74' },
  teal:      { name: 'Teal',      accent: '#1a7a7a', d: '#125858', l: '#e6f4f4', l2: '#c2e4e4', dk: '#259494', rgb: '26,122,122' },
  burgundy:  { name: 'Burgundy',  accent: '#8a2e3b', d: '#6a222c', l: '#f7e9eb', l2: '#ecd0d5', dk: '#b24452', rgb: '138,46,59' },
  orange:    { name: 'Orange',    accent: '#c4661a', d: '#9b4f13', l: '#fcefe3', l2: '#f5d9c2', dk: '#d4771f', rgb: '196,102,26' },
  slate:     { name: 'Slate',     accent: '#4a5568', d: '#333b49', l: '#edeff2', l2: '#d6dae1', dk: '#7d899c', rgb: '74,85,104' },
};
let uiAccent = ACCENTS[localStorage.getItem('uiAccent')] ? localStorage.getItem('uiAccent') : 'turquoise';
let darkMode = localStorage.getItem('uiTheme') === 'dark';

function applyAccent() {
  const a = ACCENTS[uiAccent] || ACCENTS.turquoise;
  const r = document.documentElement.style;
  r.setProperty('--accent', darkMode ? a.dk : a.accent);
  r.setProperty('--accent-d', darkMode ? a.accent : a.d);
  r.setProperty('--accent-l', darkMode ? `rgba(${a.rgb},0.18)` : a.l);
  r.setProperty('--accent-l2', darkMode ? `rgba(${a.rgb},0.34)` : a.l2);
  r.setProperty('--accent-glow', `rgba(${a.rgb},0.16)`);
  const dot = document.getElementById('accentdot');
  if (dot) dot.style.background = darkMode ? a.dk : a.accent;
}
function setAccent(key) {
  if (!ACCENTS[key]) return;
  uiAccent = key;
  localStorage.setItem('uiAccent', uiAccent);
  applyAccent();
  closeAccentMenu();
}
function applyTheme() {
  document.documentElement.classList.toggle('dark', darkMode);
  const btn = document.getElementById('themebtn');
  if (btn) btn.textContent = darkMode ? '☀️' : '🌙';
  applyAccent();
}
function toggleTheme() {
  darkMode = !darkMode;
  localStorage.setItem('uiTheme', darkMode ? 'dark' : 'light');
  applyTheme();
}
function buildAccentMenu() {
  const m = document.getElementById('accentmenu');
  if (m) m.innerHTML = Object.entries(ACCENTS).map(([k, a]) =>
    `<button class="accent-swatch${k === uiAccent ? ' on' : ''}" onclick="setAccent('${k}')"><i style="background:${a.accent}"></i>${a.name}</button>`
  ).join('');
}
function toggleAccentMenu(e) {
  e.stopPropagation();
  buildAccentMenu();
  document.getElementById('accentmenu')?.classList.toggle('open');
}
function closeAccentMenu() { document.getElementById('accentmenu')?.classList.remove('open'); }

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
    if (activeTab === 'sheet') { syncFrozen(); setTimeout(() => { syncFrozen(); scrollToToday(); }, 60); }
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
      <input class="s-edit s-edit-email" value="${h(s.email || '')}" placeholder="Email (optional)" title="Edit email"
             onchange="editStu('${s.id}','email',this.value)">
      <input class="s-edit s-edit-id" value="${h(s.studentId || '')}" placeholder="Student ID" title="Edit student ID"
             onchange="editStu('${s.id}','studentId',this.value)">
      <button class="s-del" onclick="delStu('${s.id}')" title="Remove">×</button>
    </div>`).join('');

  return `
  <div class="roster-wrap">
    <div class="add-row">
      <input class="field-input" id="ni" placeholder="Student full name" onkeydown="if(event.key==='Enter') document.getElementById('em').focus()">
      <input class="field-input s-email-input" id="em" placeholder="Email (optional)" onkeydown="if(event.key==='Enter') document.getElementById('si').focus()">
      <input class="field-input s-id-input" id="si" placeholder="Student ID" onkeydown="if(event.key==='Enter') addStu()">
      <button class="btn btn-green" onclick="addStu()">Add</button>
      <button class="btn btn-outline" onclick="pasteRosterModal()" title="Paste a class list copied from Brightspace">Paste class list</button>
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
  const email = document.getElementById('em')?.value.trim() || '';
  const studentId = document.getElementById('si')?.value.trim() || '';
  if (!name) return;
  ac().students.push({ id: uid(), name, studentId, email });
  save(); render();
  setTimeout(() => document.getElementById('ni')?.focus(), 50);
}

// ── PASTE CLASS LIST (e.g. copied from Brightspace) ──────────────────
// Pull Name + Student ID out of a pasted, tab-separated class list and skip
// non-student roles (Instructor / Teaching Assistant) and extra columns
// (email, username, dates, etc.).
const ROLE_SKIP = /^(instructor|teaching assistant|ta|course builder|grader)$/i;
const ROLE_ANY  = /^(learner|student|instructor|teaching assistant|ta|course builder|grader|auditor)$/i;

function parseRoster(text) {
  // If the paste came straight from Brightspace it has "View Profile for …"
  // markers; otherwise treat it as a plain Name + ID list.
  const isBrightspace = /view profile for/i.test(text);
  // If the list contains real IDs (5+ digit numbers) anywhere, require an ID on
  // each kept row — that automatically drops titles, headers and stray text.
  const hasIds = /\d{5,}/.test(text);
  const out = [];
  const seen = new Set();

  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let name = '', studentId = '';

    if (isBrightspace) {
      if (!/view profile for/i.test(raw)) continue; // skip headers / blank rows
      const cells = raw.split('\t').map(c => c.trim()).filter(Boolean);
      const vp = cells.find(c => /^view profile for\s+/i.test(c));
      name = vp ? vp.replace(/^view profile for\s+/i, '').trim() : '';
      studentId = cells.find(c => /^\d{5,}$/.test(c)) || '';
      const role = cells.find(c => ROLE_ANY.test(c)) || '';
      if (!name || !studentId) continue;
      if (ROLE_SKIP.test(role)) continue;      // drop instructors / TAs
    } else if (raw.includes('\t') || raw.includes(',')) {
      // Delimited (tabs from Excel, or commas from a CSV). Split on both, then
      // pick the ID and rebuild the name from the leftover word cells.
      const cells = raw.split(/[\t,]/).map(c => c.trim()).filter(Boolean);
      if (ROLE_SKIP.test(cells.find(c => ROLE_ANY.test(c)) || '')) continue; // drop instructors / TAs
      studentId = cells.find(c => /^\d{5,}$/.test(c)) || '';
      const nameParts = cells.filter(c =>
        /[A-Za-z]/.test(c) && !c.includes('@') && !/^\d+$/.test(c) && !ROLE_ANY.test(c)
      ).map(c => c.replace(/\s+is online$/i, '').trim());
      // A cell with a space is already a full name ("First Last"); otherwise the
      // name was split across cells ("Last", "First") so re-join with a comma.
      const spaced = nameParts.filter(p => /\s/.test(p)).sort((a, b) => b.length - a.length);
      name = spaced.length ? spaced[0] : nameParts.join(', ');
    } else {
      // A single space-separated line like "First Last 12345678",
      // "12345678 First Last", or "First 12345678 email@x.com".
      const tokens = raw.split(/\s+/).filter(Boolean);
      if (ROLE_SKIP.test(tokens.find(t => ROLE_ANY.test(t)) || '')) continue; // drop instructors / TAs
      studentId = tokens.find(t => /^\d{5,}$/.test(t)) || '';
      // Keep word tokens; drop the ID, emails, and role words.
      name = tokens.filter(t => /[A-Za-z]/.test(t) && !t.includes('@') && !ROLE_ANY.test(t)).join(' ');
    }

    if (!name || name.includes('@') || !/[A-Za-z]/.test(name)) continue;
    if (/^(name|student|students|first name|last name|full name|student id|id|email|username|role)$/i.test(name)) continue; // header words
    if (!isBrightspace && hasIds && !studentId) continue; // drop non-student junk when IDs are present
    if (studentId && seen.has(studentId)) continue;       // de-duplicate by ID
    if (studentId) seen.add(studentId);
    const email = (raw.match(/[^\s,;@]+@[^\s,;@]+\.[^\s,;@]+/) || [''])[0]; // capture an email if present
    out.push({ name, studentId, email });
  }
  return out;
}

let pendingPaste = [];

function pasteRosterModal() {
  modal(
    'Paste class list',
    `<p style="color:var(--text2);font-size:13px;margin-bottom:10px">Copy the class list from Brightspace and paste it below. It keeps only names and student IDs (instructors & TAs are skipped).</p>
     <textarea id="pastebox" class="field-input" style="height:120px;font-family:var(--mono);font-size:11px;resize:vertical" placeholder="Paste here…" oninput="updatePastePreview()"></textarea>
     <div id="pastepreview" style="margin-top:10px;font-size:12px;color:var(--text3)"></div>`,
    [
      { label: 'Cancel', cls: 'btn-outline', cb: closeModal },
      { label: 'Add students', cls: 'btn-green', cb: importPasted },
    ]
  );
  setTimeout(() => document.getElementById('pastebox')?.focus(), 60);
}

function updatePastePreview() {
  pendingPaste = parseRoster(document.getElementById('pastebox')?.value || '');
  const el = document.getElementById('pastepreview');
  if (!el) return;
  if (!pendingPaste.length) { el.innerHTML = 'No students detected yet.'; return; }
  const rows = pendingPaste.map((s, i) =>
    `<tr><td style="padding:2px 8px;color:var(--text3)">${i+1}</td><td style="padding:2px 8px;color:var(--text)">${h(s.name)}</td><td style="padding:2px 8px;color:var(--text2)">${h(s.email || '')}</td><td style="padding:2px 8px;font-family:var(--mono);color:var(--text2)">${h(s.studentId)}</td></tr>`
  ).join('');
  el.innerHTML = `<div style="margin-bottom:6px;color:var(--accent);font-weight:600">Found ${pendingPaste.length} student${pendingPaste.length !== 1 ? 's' : ''}:</div>
    <div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:6px"><table style="border-collapse:collapse;width:100%">${rows}</table></div>`;
}

function importPasted() {
  const cls = ac(); if (!cls) return;
  const existing = new Set(cls.students.map(s => (s.studentId || '').trim()).filter(Boolean));
  let added = 0;
  for (const s of pendingPaste) {
    if (s.studentId && existing.has(s.studentId)) continue; // skip duplicates by ID
    cls.students.push({ id: uid(), name: s.name, studentId: s.studentId, email: s.email || '' });
    if (s.studentId) existing.add(s.studentId);
    added++;
  }
  pendingPaste = [];
  closeModal(); save(); render();
  toast(added ? `Added ${added} student${added !== 1 ? 's' : ''}.` : 'No new students to add.');
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

  const today     = todayStr();
  const hasToday  = dates.includes(today);
  const hasEmails = cls.students.some(s => (s.email || '').trim()); // only show the Email column if any exist
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
      <td class="col-name-td"><div class="name-inner"><span class="row-num">${String(si+1).padStart(2,'0')}</span><span class="name-text"><span class="name-main">${h(s.name)}</span>${s.studentId ? `<span class="row-sid">${h(s.studentId)}</span>` : ''}</span></div></td>
      ${hasEmails ? `<td class="col-email-td"><span class="email-cell" title="${h(s.email || '')}">${h(s.email || '')}</span></td>` : ''}
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
  <div class="sheet-outer${hasEmails ? ' has-email' : ''}">
    <table>
      <thead><tr>
        <th class="col-name-h">Student</th>
        ${hasEmails ? '<th class="col-email-h">Email</th>' : ''}
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

// Measure the (content-sized) Name/Email columns and set the frozen left-offsets
// for the Email and Abs/T columns, so frozen columns can be adaptive width.
function syncFrozen() {
  const outer = document.querySelector('.sheet-outer');
  if (!outer) return;
  const nameH = outer.querySelector('.col-name-h');
  if (!nameH) return;
  const emailH = outer.querySelector('.col-email-h');
  const nameW  = nameH.getBoundingClientRect().width;
  const emailW = emailH ? emailH.getBoundingClientRect().width : 0;
  outer.style.setProperty('--email-left', nameW + 'px');
  outer.style.setProperty('--sum-left', (nameW + emailW) + 'px');
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
