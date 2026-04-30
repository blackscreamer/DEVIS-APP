/**
 * main.js — Electron Main Process
 * Features: landing page, close dialog, .devis extension, print/PDF
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const isDev = process.argv.includes('--dev');

/* ═══════════════════════════════════════════
   RECENT FILES — stored in userData/recents.json
═══════════════════════════════════════════ */
const RECENTS_PATH = path.join(app.getPath('userData'), 'recents.json');
const MAX_RECENTS  = 10;

function loadRecents() {
  try { return JSON.parse(fs.readFileSync(RECENTS_PATH, 'utf-8')); }
  catch { return []; }
}

function saveRecents(list) {
  try { fs.writeFileSync(RECENTS_PATH, JSON.stringify(list), 'utf-8'); } catch {}
}

function addRecent(filePath) {
  let list = loadRecents().filter(f => f !== filePath);
  list.unshift(filePath);
  if (list.length > MAX_RECENTS) list = list.slice(0, MAX_RECENTS);
  saveRecents(list);
  // Refresh landing window if open
  if (landingWindow && !landingWindow.isDestroyed()) {
    landingWindow.webContents.send('recents:updated', list);
  }
}

/* ═══════════════════════════════════════════
   DIRTY STATE — track unsaved changes
═══════════════════════════════════════════ */
let isDirty = false;

ipcMain.on('dirty:update', (_, dirty) => { isDirty = dirty; });

/* ═══════════════════════════════════════════
   FILE ASSOCIATION
═══════════════════════════════════════════ */
let openFilePath = null;

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
  if (mainWindow && !mainWindow.isDestroyed()) openInEditor(filePath);
  else if (landingWindow && !landingWindow.isDestroyed()) openFromLanding(filePath);
});

/* ═══════════════════════════════════════════
   SINGLE INSTANCE
═══════════════════════════════════════════ */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', (_e, argv) => {
    const fp = getFileFromArgs(argv);
    if (fp) {
      if (mainWindow && !mainWindow.isDestroyed()) openInEditor(fp);
      else if (landingWindow && !landingWindow.isDestroyed()) openFromLanding(fp);
    } else {
      const win = mainWindow || landingWindow;
      if (win) { win.isMinimized() && win.restore(); win.focus(); }
    }
  });
}

/* ═══════════════════════════════════════════
   LANDING WINDOW
═══════════════════════════════════════════ */
let landingWindow = null;
let mainWindow    = null;

function createLanding() {
  landingWindow = new BrowserWindow({
    width: 720, height: 560,
    resizable: false,
    title: 'Devis BTP',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-landing.js'),
    },
  });
  landingWindow.setMenuBarVisibility(false);
  landingWindow.loadFile(path.join(__dirname, 'landing.html'));
  landingWindow.on('closed', () => { landingWindow = null; });

  // Send recents once loaded
  landingWindow.webContents.once('did-finish-load', () => {
    landingWindow.webContents.send('recents:updated', loadRecents());
    // If app was launched with a file, open it directly
    if (openFilePath) openFromLanding(openFilePath);
  });
}

function openFromLanding(filePath) {
  createEditor();
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      // Flag: came from landing with a file — init.js skips loadLocal()
      await mainWindow.webContents.executeJavaScript(
        `sessionStorage.setItem('devis_origin','file')`
      );
      sendFileToEditor(filePath);
    }, 100);
  });
  if (landingWindow && !landingWindow.isDestroyed()) landingWindow.close();
}

/* ═══════════════════════════════════════════
   EDITOR WINDOW
═══════════════════════════════════════════ */
function createEditor() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860,
    minWidth: 900, minHeight: 600,
    title: 'Devis BTP — DQE / BPU',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  if (isDev) mainWindow.webContents.openDevTools();
  buildMenu();

  /* ── Close dialog ── */
  mainWindow.on('close', async (e) => {
    if (!isDirty) return; // nothing to save, close freely
    e.preventDefault();
    const { response } = await dialog.showMessageBox(mainWindow, {
      type:    'warning',
      title:   'Modifications non sauvegardées',
      message: 'Vous avez des modifications non sauvegardées.',
      detail:  'Voulez-vous sauvegarder avant de quitter ?',
      buttons: ['Sauvegarder', 'Quitter sans sauvegarder', 'Annuler'],
      defaultId: 0,
      cancelId:  2,
    });
    if (response === 0) {
      // Ask renderer to save, then quit
      mainWindow.webContents.send('menu:save');
      ipcMain.once('save:done', () => {
        isDirty = false;
        mainWindow.destroy();
      });
    } else if (response === 1) {
      isDirty = false;
      mainWindow.destroy();
    }
    // response === 2 → Annuler, do nothing
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Return to landing when editor closes (unless app is quitting)
    if (!app.isQuitting) createLanding();
  });
}

function sendFileToEditor(fp) {
  try {
    const content = fs.readFileSync(fp, 'utf-8');
    mainWindow.webContents.send('file:opened', { path: fp, content });
    mainWindow.setTitle(path.basename(fp, path.extname(fp)) + ' — Devis BTP');
    addRecent(fp);
    isDirty = false;
  } catch (e) {
    dialog.showErrorBox('Erreur', `Impossible d'ouvrir :\n${fp}\n\n${e.message}`);
  }
}

// Legacy alias for internal use
const openInEditor = sendFileToEditor;

app.whenReady().then(createLanding);

app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => {
  if (!BrowserWindow.getAllWindows().length) createLanding();
});

/* ═══════════════════════════════════════════
   LANDING IPC
═══════════════════════════════════════════ */
ipcMain.handle('landing:new', async (_, mode) => {
  createEditor();
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      // Flag: came from landing as new project — init.js skips loadLocal()
      await mainWindow.webContents.executeJavaScript(
        `sessionStorage.setItem('devis_origin','new')`
      );
      mainWindow.webContents.send('project:new', mode || 'DQE');
    }, 100);
  });
  if (landingWindow && !landingWindow.isDestroyed()) landingWindow.close();
});

ipcMain.handle('landing:open', async () => {
  const r = await dialog.showOpenDialog(landingWindow || mainWindow, {
    title: 'Ouvrir un projet',
    filters: [
      { name: 'Projet Devis BTP', extensions: ['devis', 'json'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!r.canceled && r.filePaths[0]) openFromLanding(r.filePaths[0]);
});

ipcMain.handle('landing:openRecent', async (_, filePath) => {
  if (!fs.existsSync(filePath)) {
    dialog.showErrorBox('Fichier introuvable', `Le fichier n'existe plus :\n${filePath}`);
    // Remove from recents
    const list = loadRecents().filter(f => f !== filePath);
    saveRecents(list);
    if (landingWindow) landingWindow.webContents.send('recents:updated', list);
    return;
  }
  openFromLanding(filePath);
});

ipcMain.handle('landing:removeRecent', async (_, filePath) => {
  const list = loadRecents().filter(f => f !== filePath);
  saveRecents(list);
  return list;
});

/* ═══════════════════════════════════════════
   MENU
═══════════════════════════════════════════ */
function buildMenu() {
  if (!mainWindow) return;
  const send = (ch, ...a) => mainWindow.webContents.send(ch, ...a);
  const tpl = [
    { label: 'Fichier', submenu: [
      { label: 'Nouveau',            accelerator: 'CmdOrCtrl+N',       click: () => send('menu:new')         },
      { type: 'separator' },
      { label: 'Ouvrir…',           accelerator: 'CmdOrCtrl+O',       click: menuOpen                       },
      { label: 'Sauvegarder',       accelerator: 'CmdOrCtrl+S',       click: () => send('menu:save')        },
      { label: 'Sauvegarder sous…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:saveAs')      },
      { type: 'separator' },
      { label: 'Importer Excel…',   click: menuImportExcel                                                   },
      { label: 'Exporter Excel…',   accelerator: 'CmdOrCtrl+E',       click: () => send('menu:exportExcel') },
      { label: 'Exporter PDF…',     accelerator: 'CmdOrCtrl+Shift+E', click: () => send('menu:exportPdf')   },
      { label: 'Imprimer…',         accelerator: 'CmdOrCtrl+P',       click: () => send('menu:print')       },
      { type: 'separator' },
      { label: 'Quitter',           accelerator: 'CmdOrCtrl+Q',       role: 'quit'                          },
    ]},
    { label: 'Édition', submenu: [
      { label: 'Annuler',  accelerator: 'CmdOrCtrl+Z', click: () => send('menu:undo') },
      { label: 'Rétablir', accelerator: 'CmdOrCtrl+Y', click: () => send('menu:redo') },
      { type: 'separator' },
      { label: 'Couper',    role: 'cut' }, { label: 'Copier', role: 'copy' },
      { label: 'Coller',    role: 'paste' }, { label: 'Tout sélectionner', role: 'selectAll' },
    ]},
    { label: 'Affichage', submenu: [
      { label: 'Mode DQE', click: () => send('menu:mode', 'DQE') },
      { label: 'Mode BPU', click: () => send('menu:mode', 'BPU') },
      { type: 'separator' },
      { label: 'Masquer / Afficher prix', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('menu:togglePrices') },
      { type: 'separator' },
      { label: 'Réduire tout',    click: () => send('menu:collapseAll', true)  },
      { label: 'Développer tout', click: () => send('menu:collapseAll', false) },
      { type: 'separator' },
      { label: 'Recharger',    accelerator: 'F5',          role: 'reload'           },
      { label: 'DevTools',     accelerator: 'F12',         role: 'toggleDevTools'   },
      { label: 'Plein écran',  accelerator: 'F11',         role: 'togglefullscreen' },
      { label: 'Zoom +',       accelerator: 'CmdOrCtrl+=', role: 'zoomIn'           },
      { label: 'Zoom -',       accelerator: 'CmdOrCtrl+-', role: 'zoomOut'          },
      { label: 'Zoom 100%',    accelerator: 'CmdOrCtrl+0', role: 'resetZoom'        },
    ]},
    { label: 'Aide', submenu: [
      { label: 'À propos',    click: showAbout },
      { label: 'Code source', click: () => shell.openExternal('https://github.com/blackscreamer/DEVIS-APP') },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ═══════════════════════════════════════════
   FILE DIALOGS (editor)
═══════════════════════════════════════════ */
async function menuOpen() {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un projet',
    filters: [
      { name: 'Projet Devis BTP', extensions: ['devis', 'json'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!r.canceled && r.filePaths[0]) sendFileToEditor(r.filePaths[0]);
}

async function menuImportExcel() {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer Excel',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });
  if (!r.canceled && r.filePaths[0])
    mainWindow.webContents.send('file:importExcel', fs.readFileSync(r.filePaths[0]));
}

ipcMain.handle('dialog:save', async (_, { content, defaultName, currentPath }) => {
  let savePath = currentPath;
  if (!savePath) {
    const defName = (defaultName || 'devis').replace(/\.json$/, '') + '.devis';
    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Sauvegarder',
      defaultPath: defName,
      filters: [
        { name: 'Projet Devis BTP', extensions: ['devis'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    });
    if (r.canceled) return null;
    savePath = r.filePath;
  }
  fs.writeFileSync(savePath, content, 'utf-8');
  const title = path.basename(savePath, path.extname(savePath)) + ' — Devis BTP';
  mainWindow.setTitle(title);
  addRecent(savePath);
  isDirty = false;
  ipcMain.emit('save:done');
  return savePath;
});

ipcMain.handle('dialog:saveAs', async (_, { content, defaultName }) => {
  const defName = (defaultName || 'devis').replace(/\.json$/, '') + '.devis';
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Sauvegarder sous…',
    defaultPath: defName,
    filters: [
      { name: 'Projet Devis BTP', extensions: ['devis'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, content, 'utf-8');
  mainWindow.setTitle(path.basename(r.filePath, path.extname(r.filePath)) + ' — Devis BTP');
  addRecent(r.filePath);
  isDirty = false;
  ipcMain.emit('save:done');
  return r.filePath;
});

ipcMain.handle('file:saveBackup', async (_, { content, currentPath }) => {
  if (!currentPath) return null;
  const bp = path.join(
    path.dirname(currentPath),
    path.basename(currentPath, path.extname(currentPath)) + '.backup.devis'
  );
  try { fs.writeFileSync(bp, content, 'utf-8'); return bp; }
  catch (e) { return null; }
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
   PRINT
═══════════════════════════════════════════ */
const TEMP_PRINT = path.join(os.tmpdir(), 'devis_print.html');
let printWin = null;

ipcMain.handle('file:print', async (_, { html }) => {
  try {
    fs.writeFileSync(TEMP_PRINT, html, 'utf-8');
    if (printWin && !printWin.isDestroyed()) printWin.close();
    printWin = new BrowserWindow({
      width: 1100, height: 850, minWidth: 800, minHeight: 600,
      title: 'Impression — Devis BTP',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await printWin.loadFile(TEMP_PRINT);
    await new Promise(res => setTimeout(res, 300));
    await printWin.webContents.executeJavaScript('window.print()');
    printWin.on('closed', () => {
      printWin = null;
      try { fs.unlinkSync(TEMP_PRINT); } catch {}
    });
    return true;
  } catch (e) {
    dialog.showErrorBox('Erreur impression', e.message);
    return false;
  }
});

/* ═══════════════════════════════════════════
   PDF
═══════════════════════════════════════════ */
const TEMP_PDF = path.join(os.tmpdir(), 'devis_pdf_render.html');

ipcMain.handle('file:exportPdf', async (_, { html, defaultName }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter en PDF', defaultPath: defaultName || 'devis.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled) return null;
  fs.writeFileSync(TEMP_PDF, html, 'utf-8');
  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  try {
    await new Promise((resolve, reject) => {
      pdfWin.loadFile(TEMP_PDF);
      pdfWin.webContents.once('did-finish-load', resolve);
      pdfWin.webContents.once('did-fail-load', reject);
    });
    await new Promise(res => setTimeout(res, 500));
    const pdfData = await pdfWin.webContents.printToPDF({ printBackground: true });
    pdfWin.close();
    try { fs.unlinkSync(TEMP_PDF); } catch {}
    fs.writeFileSync(r.filePath, pdfData);
    shell.openPath(r.filePath);
    return r.filePath;
  } catch (e) {
    pdfWin.close();
    try { fs.unlinkSync(TEMP_PDF); } catch {}
    dialog.showErrorBox('Erreur PDF', e.message);
    return null;
  }
});

/* ═══════════════════════════════════════════
   ABOUT
═══════════════════════════════════════════ */
function showAbout() {
  dialog.showMessageBox(mainWindow || landingWindow, {
    type: 'info', title: 'Devis BTP',
    message: 'Devis BTP — DQE / BPU\nVersion 1.0.0',
    detail: 'Application de gestion de devis BTP.\nDinar Algérien (DA)\n\ngithub.com/blackscreamer/DEVIS-APP',
    buttons: ['OK'],
  });
}
