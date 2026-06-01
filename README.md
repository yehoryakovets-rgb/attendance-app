# Attendance Manager — Build & Distribute Instructions

You're on Windows, she's on Mac. GitHub will build the Mac app for you for free.

---

## Step 1 — Create a GitHub account
Go to https://github.com and sign up (free). Confirm your email.

---

## Step 2 — Create a new repository
1. Click the **+** icon top-right → **New repository**
2. Name it: `attendance-manager`
3. Set it to **Private** (so the code isn't public)
4. Click **Create repository**

---

## Step 3 — Upload the project files
On the empty repo page, click **uploading an existing file**.

Upload ALL files maintaining the folder structure:
- `package.json`
- `README.md`
- `src/main.js`
- `src/preload.js`
- `src/index.html`
- `src/renderer.js`
- `assets/icon.svg`
- `.github/workflows/build.yml`

Click **Commit changes**.

---

## Step 4 — Watch it build
1. Click the **Actions** tab at the top of your repo
2. You'll see "Build Mac App" running (takes ~5 minutes)
3. Wait for the green checkmark ✓

---

## Step 5 — Download the .dmg
1. Click on the completed "Build Mac App" run
2. Scroll to the bottom — find **Artifacts**
3. Click **Attendance-Manager-Mac** to download a zip
4. Unzip it — inside is `Attendance Manager.dmg`

---

## Step 6 — Send it to her
Email her the `.dmg` file (or Google Drive / WeTransfer if it's too large for email).

She:
1. Opens the `.dmg`
2. Drags the app to her Applications folder
3. Double-clicks it — done

**If macOS says "can't be opened because Apple cannot check it for malicious software":**
She right-clicks the app → Open → Open (she only needs to do this once).

---

## Where is her data saved?
`~/Library/Application Support/attendance-manager/attendance-data.json`

- Never auto-deleted by macOS
- Survives app updates
- Only gone if she deliberately uninstalls the app

---

## Rebuilding after changes
Any time you push new code to GitHub, the workflow runs again automatically
and produces a fresh `.dmg` in the Actions tab.
