# Attendance Manager

A simple, offline desktop app for professors to track class attendance and export clean Excel reports. Built with Electron; runs on macOS.

---

## Overview

Attendance Manager lets you set up your courses, build a student roster, and mark attendance session-by-session with a single click. It calculates absences, tardies, and attendance percentages automatically, and exports a polished Excel workbook for your records. All data is stored locally on your computer and saved automatically — there's no account, no internet connection, and nothing to configure.

---

## Main features

- **Multiple classes** — track as many courses as you like, each with its own college, course name, semester, instructor, schedule, and roster.
- **Automatic schedule** — set a start date, end date, and meeting days, and the app generates every class session for you.
- **One-click attendance** — click a cell to cycle a student through Present → Absent → Tardy. Present is the default, so you only mark the exceptions.
- **Today, front and center** — the current day's column is highlighted and the sheet scrolls straight to it when you open a class, with a "Jump to Today" button to snap back.
- **Live statistics** — per-student absences, tardies, and attendance percentage, color-coded so at-risk students stand out.
- **Editable roster** — add students with an optional Student ID, and edit any name or ID later in place.
- **Excel export** — produces a formatted `.xlsx` with a header block (course, college, instructor, semester, export date), a full attendance grid, and a course-info sheet. Files are named with the export date and filed into a per-class folder automatically.
- **Safe by design** — every change is saved automatically, with timestamped backups and automatic recovery if a data file is ever damaged.

---

## How to use

### 1. Create a class
From the home screen, click **New Class**. In **Settings**, fill in the college, course name, semester, and instructor, then set the **start date**, **end date**, and **meeting days**. The app shows how many sessions that produces.

### 2. Add students
Open the **Roster** tab. Type a student's full name (and optional Student ID) and click **Add** — or press Enter to move from the name to the ID field. To fix a name or ID later, just click it, edit, and click away; it saves automatically.

### 3. Take attendance
Open the **Sheet** tab. Today's column is highlighted. For each student who is absent or late, click their cell for that day:

- One click → **A** (Absent)
- Two clicks → **T** (Tardy)
- Three clicks → back to Present

Everyone else is counted present automatically. Absences, tardies, and attendance % update instantly on the right.

### 4. Export to Excel
Click **Export Excel**. The first time, you choose a folder to keep all your exports in; after that the app remembers it. Each export is saved into that class's own subfolder, named with the export date, and the folder opens automatically so you can find the file.

---

## Download & install (macOS)

Download the latest version from the **[Releases page](https://github.com/yehoryakovets-rgb/attendance-app/releases/latest)**:

1. Under **Assets**, download the file ending in **`-arm64-mac.zip`** (for Apple Silicon Macs — M1/M2/M3/M4). For older Intel Macs, use the one ending in `-mac.zip`.
2. Double-click the `.zip` to unpack **Attendance Manager.app**, then drag it into your **Applications** folder.
3. The first time you open it, macOS may warn that it can't verify the developer (the app is unsigned). To allow it: open  → **System Settings → Privacy & Security**, scroll to the bottom, and click **Open Anyway**.
4. After that first time, just double-click the app whenever you need it.

---

## Building from source

The app is built automatically on every version tag via GitHub Actions (see `.github/workflows/build.yml`), which produces the macOS `.zip` files attached to each Release.

To run or build locally:

```bash
npm install      # install dependencies
npm start        # run the app in development
npm run build    # build the macOS app into dist/
```

Building the macOS app requires running on a Mac.
