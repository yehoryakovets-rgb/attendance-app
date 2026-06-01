const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const DATA_FILE  = path.join(app.getPath('userData'), 'attendance-data.json');
const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');

// Keep a new backup at most this often (ms), and retain this many at most.
const BACKUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_BACKUPS        = 40;

// Returns backup files (newest first) as { name, full }.
function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('attendance-data-') && f.endsWith('.json'))
      .sort().reverse()
      .map(name => ({ name, full: path.join(BACKUP_DIR, name) }));
  } catch (e) { return []; }
}

// Write a timestamped backup if enough time has passed since the last one,
// then prune old backups down to MAX_BACKUPS.
function maybeBackup(jsonStr) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const backups = listBackups();
    if (backups.length) {
      const age = Date.now() - fs.statSync(backups[0].full).mtimeMs;
      if (age < BACKUP_INTERVAL_MS) return; // too soon, skip
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tmp   = path.join(BACKUP_DIR, '.' + stamp + '.tmp');
    const dest  = path.join(BACKUP_DIR, 'attendance-data-' + stamp + '.json');
    fs.writeFileSync(tmp, jsonStr, 'utf8');
    fs.renameSync(tmp, dest);
    for (const old of listBackups().slice(MAX_BACKUPS)) {
      try { fs.unlinkSync(old.full); } catch (e) {}
    }
  } catch (e) { /* backups are best-effort; never block a save */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f2ed',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Attendance Manager',
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('load-data', () => {
  // Try the main file first.
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { /* main file missing or corrupt — fall back to backups */ }

  // Auto-recover: walk backups newest-first and return the first valid one.
  for (const b of listBackups()) {
    try {
      const data = JSON.parse(fs.readFileSync(b.full, 'utf8'));
      // Restore the recovered copy as the live file so we're consistent again.
      try { fs.copyFileSync(b.full, DATA_FILE); } catch (e) {}
      return data;
    } catch (e) { /* this backup is bad too, try the next */ }
  }
  return null;
});

ipcMain.handle('save-data', (_, data) => {
  try {
    const json = JSON.stringify(data);
    const tmp  = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, DATA_FILE);
    maybeBackup(json);
    return true;
  } catch (e) { return false; }
});

const DAYS_MAIN  = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const MONS_MAIN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function genDatesMain(s, e, days) {
  if (!s || !e || !days?.length) return [];
  const res = [], idxs = days.map(d => DAYS_MAIN.indexOf(d) + 1);
  const cur = new Date(s + 'T12:00:00'), end = new Date(e + 'T12:00:00');
  while (cur <= end) {
    if (idxs.includes(cur.getDay())) res.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return res;
}

function fmtShortMain(ds) {
  const d = new Date(ds + 'T12:00:00');
  return MONS_MAIN[d.getMonth()] + ' ' + d.getDate();
}

function statsMain(cls, sid, dates) {
  let abs = 0, tardy = 0;
  for (const ds of dates) {
    const v = cls.attendance?.[sid]?.[ds] || '';
    if (v === 'A') abs++; else if (v === 'T') tardy++;
  }
  return { abs, tardy, pct: dates.length ? Math.round(((dates.length - abs) / dates.length) * 100) : 100 };
}

// Strip characters that are illegal in file/folder names.
function safeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

ipcMain.handle('export-xlsx', async (_, { cls }) => {
  // The user picks a parent location; we create a class-named subfolder inside it.
  const res = await dialog.showOpenDialog({
    title: 'Choose where to export',
    buttonLabel: 'Export Here',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return false;

  try {
    const dates = genDatesMain(cls.startDate, cls.endDate, cls.meetingDays);
    const wb = XLSX.utils.book_new();

    // Header info block, shown at the top-left of the Attendance sheet.
    const head = [
      'Course:  '     + (cls.name || ''),
      'College:  '    + (cls.college || ''),
      'Instructor:  ' + (cls.instructor || ''),
      'Semester:  '   + (cls.semester || ''),
      'Exported:  '   + new Date().toLocaleDateString(),
    ];
    const HR = head.length + 1; // table-header row index (one blank row below the info block)

    const hdr = ['#', 'Student', 'Student ID', 'Abs/Tardy', ...dates.map(fmtShortMain), 'Absences', 'Tardies', 'Att %'];
    const data = cls.students.map((s, i) => {
      const st = statsMain(cls, s.id, dates);
      return [i + 1, s.name, s.studentId || '', st.abs + '/' + st.tardy, ...dates.map(ds => cls.attendance?.[s.id]?.[ds] || 'P'), st.abs, st.tardy, st.pct / 100];
    });

    const aoa = [...head.map(line => [line]), [], hdr, ...data];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 9 }, ...dates.map(() => ({ wch: 7 })), { wch: 9 }, { wch: 7 }, { wch: 8 }];

    const enc = XLSX.utils.encode_cell;
    const nc = hdr.length, dc = 4, de = 4 + dates.length - 1;
    const sHEAD = { font: { bold: true, sz: 12, color: { rgb: '3B6B4A' } } };
    const sHG = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '3B6B4A' } }, alignment: { horizontal: 'center' } };
    const sHN = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '3B6B4A' } }, alignment: { horizontal: 'left' } };
    const sA  = { font: { bold: true, color: { rgb: 'B03030' } }, fill: { fgColor: { rgb: 'FDF0F0' } }, alignment: { horizontal: 'center' } };
    const sT  = { font: { bold: true, color: { rgb: 'B06A1A' } }, fill: { fgColor: { rgb: 'FDF5EA' } }, alignment: { horizontal: 'center' } };
    const sP  = { font: { color: { rgb: 'BBBBBB' } }, alignment: { horizontal: 'center' } };
    const sC  = { alignment: { horizontal: 'center' } };
    const sPL = { font: { bold: true, color: { rgb: 'B03030' } }, numFmt: '0%', alignment: { horizontal: 'center' } };
    const sPM = { font: { color: { rgb: 'B06A1A' } }, numFmt: '0%', alignment: { horizontal: 'center' } };
    const sPO = { font: { color: { rgb: '2D6B3A' } }, numFmt: '0%', alignment: { horizontal: 'center' } };

    // Info block — bold green; each line sits in column A and overflows across the empty cells beside it.
    for (let r = 0; r < head.length; r++) { const ref = enc({ r, c: 0 }); if (ws[ref]) ws[ref].s = sHEAD; }

    // Table header row.
    for (let c = 0; c < nc; c++) { const ref = enc({ r: HR, c }); if (!ws[ref]) ws[ref] = { v: hdr[c], t: 's' }; ws[ref].s = c === 1 ? sHN : sHG; }

    // Data rows.
    for (let i = 0; i < cls.students.length; i++) {
      const r = HR + 1 + i;
      const st = statsMain(cls, cls.students[i].id, dates);
      for (let c = 0; c < nc; c++) {
        const ref = enc({ r, c }); if (!ws[ref]) ws[ref] = { v: '', t: 's' };
        if (c >= dc && c <= de) { const v = ws[ref].v; ws[ref].s = v === 'A' ? sA : v === 'T' ? sT : sP; }
        else if (c === nc - 1) { ws[ref].t = 'n'; ws[ref].v = st.pct / 100; ws[ref].z = '0%'; ws[ref].s = st.pct < 80 ? sPL : st.pct < 90 ? sPM : sPO; }
        else if (c !== 1) ws[ref].s = sC;
      }
    }

    const inf = [
      ['College', cls.college || ''], ['Course', cls.name || ''], ['Semester', cls.semester || ''], ['Instructor', cls.instructor || ''],
      ['Start Date', cls.startDate || ''], ['End Date', cls.endDate || ''],
      ['Meeting Days', (cls.meetingDays || []).join(', ')],
      ['Total Sessions', dates.length], ['Total Students', cls.students.length],
      ['Exported', new Date().toLocaleDateString()],
    ];
    const wi = XLSX.utils.aoa_to_sheet(inf);
    wi['!cols'] = [{ wch: 18 }, { wch: 32 }];
    for (let r = 0; r < inf.length; r++) { const ref = enc({ r, c: 0 }); if (wi[ref]) wi[ref].s = { font: { bold: true } }; }

    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.utils.book_append_sheet(wb, wi, 'Course Info');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Create a "<Course> <Semester>" folder inside the chosen location and save the dated file there.
    const dateStr    = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const folderName = safeName((cls.name || 'Class') + ' ' + (cls.semester || '')) || 'Attendance Export';
    const fileBase   = (safeName(cls.name || 'attendance') || 'attendance').replace(/\s+/g, '-')
                     + '_' + (safeName(cls.semester || 'export') || 'export').replace(/\s+/g, '-');
    const outDir     = path.join(res.filePaths[0], folderName);
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, fileBase + '_' + dateStr + '.xlsx');
    fs.writeFileSync(filePath, buf);
    shell.showItemInFolder(filePath); // open the folder so she can find the file
    return true;
  } catch (e) { return false; }
});
