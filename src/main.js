/**
 * main.js — Electron Main Process
 *
 * Print strategy:
 *   1. Renderer calls buildPrintHTML() → full self-contained HTML string
 *   2. Main writes it to a temp file (OS temp dir)
 *   3. A VISIBLE preview BrowserWindow loads that file:// URL
 *   4. The preview window shows the document exactly as it will print
 *   5. User clicks "Imprimer" button in preview → window.print() → OS dialog
 *   6. User clicks "PDF" button in preview → IPC → printToPDF → save dialog
 *   7. Preview window closes after action
 *
 * This approach is reliable because:
 *   - file:// URLs load all resources correctly (no CSP issues)
 *   - The preview window is VISIBLE so the user sees exactly what prints
 *   - window.print() in the preview always opens the OS print dialog
 *   - printToPDF works perfectly on a fully loaded file:// page
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const isDev = process.argv.includes('--dev');

/* ═══ FILE ASSOCIATION ═══ */
let openFilePath = null;
let previewWin   = null; // reference to current preview window

function getFileFromArgs(argv) {
  return argv.slice(isDev ? 2 : 1).find(a =>
    !a.startsWith('-') &&
    (a.endsWith('.json') || a.endsWith('.devis')) &&
    fs.existsSync(a)
  ) || null;
}
openFilePath = getFileFromArgs(process.argv);

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openFilePath = filePath;
  if (mainWindow) sendFileToRenderer(filePath);
});

/* ═══ SINGLE INSTANCE ═══ */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', (_e, argv) => {
    const fp = getFileFromArgs(argv);
    if (mainWindow) { mainWindow.isMinimized() && mainWindow.restore(); mainWindow.focus(); if (fp) sendFileToRenderer(fp); }
  });
}

/* ═══ MAIN WINDOW ═══ */
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    title: 'Devis BTP — DQE / BPU',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  if (isDev) mainWindow.webContents.openDevTools();
  mainWindow.webContents.once('did-finish-load', () => {
    if (openFilePath) setTimeout(() => sendFileToRenderer(openFilePath), 600);
  });
  buildMenu();
}

function sendFileToRenderer(fp) {
  try {
    mainWindow.webContents.send('file:opened', { path: fp, content: fs.readFileSync(fp, 'utf-8') });
    mainWindow.setTitle(path.basename(fp, path.extname(fp)) + ' — Devis BTP');
  } catch (e) { dialog.showErrorBox('Erreur', `Impossible d'ouvrir:\n${fp}\n\n${e.message}`); }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

/* ═══ MENU ═══ */
function buildMenu() {
  const send = (ch, ...a) => mainWindow.webContents.send(ch, ...a);
  const tpl = [
    { label: 'Fichier', submenu: [
      { label: 'Nouveau',            accelerator: 'CmdOrCtrl+N',       click: () => send('menu:new')          },
      { type: 'separator' },
      { label: 'Ouvrir…',           accelerator: 'CmdOrCtrl+O',       click: menuOpen                        },
      { label: 'Sauvegarder',       accelerator: 'CmdOrCtrl+S',       click: () => send('menu:save')         },
      { label: 'Sauvegarder sous…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:saveAs')       },
      { type: 'separator' },
      { label: 'Importer Excel…',   click: menuImportExcel                                                    },
      { label: 'Exporter Excel…',   accelerator: 'CmdOrCtrl+E',       click: () => send('menu:exportExcel')  },
      { label: 'Aperçu / Imprimer', accelerator: 'CmdOrCtrl+P',       click: () => send('menu:preview')      },
      { type: 'separator' },
      { label: 'Quitter',           accelerator: 'CmdOrCtrl+Q',       role: 'quit'                           },
    ]},
    { label: 'Édition', submenu: [
      { label: 'Annuler',  accelerator: 'CmdOrCtrl+Z', click: () => send('menu:undo') },
      { label: 'Rétablir', accelerator: 'CmdOrCtrl+Y', click: () => send('menu:redo') },
      { type: 'separator' },
      { label: 'Couper',    role: 'cut' }, { label: 'Copier', role: 'copy' },
      { label: 'Coller',    role: 'paste' }, { label: 'Tout sélectionner', role: 'selectAll' },
    ]},
    { label: 'Affichage', submenu: [
      { label: 'Mode DQE', click: () => send('menu:mode','DQE') },
      { label: 'Mode BPU', click: () => send('menu:mode','BPU') },
      { type: 'separator' },
      { label: 'Masquer / Afficher prix', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('menu:togglePrices') },
      { type: 'separator' },
      { label: 'Réduire tout',    click: () => send('menu:collapseAll', true)  },
      { label: 'Développer tout', click: () => send('menu:collapseAll', false) },
      { type: 'separator' },
      { label: 'Recharger',     accelerator: 'F5',          role: 'reload'           },
      { label: 'DevTools',      accelerator: 'F12',         role: 'toggleDevTools'   },
      { label: 'Plein écran',   accelerator: 'F11',         role: 'togglefullscreen' },
      { label: 'Zoom +',        accelerator: 'CmdOrCtrl+=', role: 'zoomIn'           },
      { label: 'Zoom -',        accelerator: 'CmdOrCtrl+-', role: 'zoomOut'          },
      { label: 'Zoom 100%',     accelerator: 'CmdOrCtrl+0', role: 'resetZoom'        },
    ]},
    { label: 'Aide', submenu: [
      { label: 'À propos',    click: showAbout },
      { label: 'Code source', click: () => shell.openExternal('https://github.com/blackscreamer/DEVIS-APP') },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ═══ FILE DIALOGS ═══ */
async function menuOpen() {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un projet',
    filters: [{ name: 'Projet Devis BTP', extensions: ['json','devis'] }, { name: 'Tous', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (!r.canceled && r.filePaths[0]) sendFileToRenderer(r.filePaths[0]);
}

async function menuImportExcel() {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer Excel',
    filters: [{ name: 'Excel', extensions: ['xlsx','xls'] }],
    properties: ['openFile'],
  });
  if (!r.canceled && r.filePaths[0])
    mainWindow.webContents.send('file:importExcel', fs.readFileSync(r.filePaths[0]));
}

ipcMain.handle('dialog:save', async (_, { content, defaultName, currentPath }) => {
  let savePath = currentPath;
  if (!savePath) {
    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Sauvegarder', defaultPath: defaultName || 'devis.json',
      filters: [{ name: 'Projet Devis BTP', extensions: ['json'] }],
    });
    if (r.canceled) return null;
    savePath = r.filePath;
  }
  fs.writeFileSync(savePath, content, 'utf-8');
  mainWindow.setTitle(path.basename(savePath, path.extname(savePath)) + ' — Devis BTP');
  return savePath;
});

ipcMain.handle('dialog:saveAs', async (_, { content, defaultName }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Sauvegarder sous…', defaultPath: defaultName || 'devis.json',
    filters: [{ name: 'Projet Devis BTP', extensions: ['json'] }],
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, content, 'utf-8');
  mainWindow.setTitle(path.basename(r.filePath, path.extname(r.filePath)) + ' — Devis BTP');
  return r.filePath;
});

ipcMain.handle('file:saveBackup', async (_, { content, currentPath }) => {
  if (!currentPath) return null;
  const bp = path.join(path.dirname(currentPath), path.basename(currentPath, path.extname(currentPath)) + '.backup.json');
  try { fs.writeFileSync(bp, content, 'utf-8'); return bp; } catch (e) { return null; }
});

ipcMain.handle('dialog:saveExcel', async (_, { buffer, defaultName }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter Excel', defaultPath: defaultName || 'devis.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, Buffer.from(buffer));
  return r.filePath;
});

/* ═══════════════════════════════════════════
   PREVIEW WINDOW
   
   Opens a visible window showing the document exactly as it will
   print. The window has its own toolbar with:
     - Print button  → opens OS native print dialog (with printer choice + preview)
     - PDF button    → save dialog + export PDF
     - Close button  → closes preview
   
   Using file:// URL (temp file) so all CSS and fonts load correctly.
═══════════════════════════════════════════ */
const TEMP_PREVIEW = path.join(os.tmpdir(), 'devis_print_preview.html');

ipcMain.handle('preview:open', async (_, { html }) => {
  // Write HTML to temp file so it loads as file:// (reliable CSS loading)
  fs.writeFileSync(TEMP_PREVIEW, html, 'utf-8');

  // Close any existing preview
  if (previewWin && !previewWin.isDestroyed()) previewWin.close();

  previewWin = new BrowserWindow({
    width: 900, height: 800,
    minWidth: 700, minHeight: 500,
    title: 'Aperçu avant impression — Devis BTP',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    parent: mainWindow,    // stays on top of main window
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-preview.js'),
    },
  });

  previewWin.loadFile(TEMP_PREVIEW);
  previewWin.on('closed', () => { previewWin = null; });
});

/* Triggered by "Imprimer" button in the preview window */
ipcMain.handle('preview:print', () => new Promise(resolve => {
  if (!previewWin || previewWin.isDestroyed()) { resolve(false); return; }
  previewWin.webContents.print(
    { silent: false, printBackground: true },
    (success) => resolve(success)
  );
}));

/* Triggered by "Exporter PDF" button in the preview window */
ipcMain.handle('preview:exportPdf', async (_, { defaultName }) => {
  if (!previewWin || previewWin.isDestroyed()) return null;

  const r = await dialog.showSaveDialog(previewWin, {
    title: 'Exporter en PDF', defaultPath: defaultName || 'devis.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled) return null;

  try {
    const pdfData = await previewWin.webContents.printToPDF({
      printBackground:     true,
      displayHeaderFooter: false,
      headerTemplate:      '',
      footerTemplate:      '',
      // Page size and margins come from the @page CSS rule in the HTML
    });
    fs.writeFileSync(r.filePath, pdfData);
    shell.openPath(r.filePath);

    // Clean up temp file
    try { fs.unlinkSync(TEMP_PREVIEW); } catch(e) {}
    previewWin.close();
    return r.filePath;
  } catch (e) {
    dialog.showErrorBox('Erreur PDF', e.message);
    return null;
  }
});

/* ═══ ABOUT ═══ */
ipcMain.handle('preview:close', () => {
  if (previewWin && !previewWin.isDestroyed()) previewWin.close();
});
function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info', title: 'Devis BTP',
    message: 'Devis BTP — DQE / BPU\nVersion 1.0.0',
    detail: 'Application de gestion de devis BTP.\nDinar Algérien (DA)',
    buttons: ['OK'],
  });
}
