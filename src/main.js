/**
 * main.js — Electron Main Process
 *
 * Print strategy (NEW — simple and reliable):
 *   1. Renderer builds a self-contained HTML string (buildPrintHTML)
 *   2. Main writes it to a temp file
 *   3. shell.openExternal() opens it in the user's DEFAULT BROWSER
 *   4. The browser has a full native print dialog: printer choice, preview,
 *      margins, copies, page range — everything works perfectly
 *   5. User prints or cancels, closes the browser tab
 *
 * Why this works when Electron's own print didn't:
 *   - No Electron window management needed
 *   - Browser print dialog is mature and well-tested
 *   - Colors preserved via print-color-adjust: exact in the HTML
 *   - Zero IPC complexity
 *
 * PDF: still uses printToPDF on a hidden BrowserWindow (works reliably)
 * Excel: unchanged (ExcelJS)
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const isDev = process.argv.includes('--dev');

/* ═══ FILE ASSOCIATION ═══ */
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
  if (mainWindow) sendFileToRenderer(filePath);
});

/* ═══ SINGLE INSTANCE ═══ */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', (_e, argv) => {
    const fp = getFileFromArgs(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (fp) sendFileToRenderer(fp);
    }
  });
}

/* ═══ MAIN WINDOW ═══ */
let mainWindow;

function createWindow() {
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
  mainWindow.webContents.once('did-finish-load', () => {
    if (openFilePath) setTimeout(() => sendFileToRenderer(openFilePath), 600);
  });
  buildMenu();
}

function sendFileToRenderer(fp) {
  try {
    mainWindow.webContents.send('file:opened', {
      path: fp,
      content: fs.readFileSync(fp, 'utf-8'),
    });
    mainWindow.setTitle(path.basename(fp, path.extname(fp)) + ' — Devis BTP');
  } catch (e) {
    dialog.showErrorBox('Erreur', `Impossible d'ouvrir :\n${fp}\n\n${e.message}`);
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

/* ═══ MENU ═══ */
function buildMenu() {
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
      { label: 'Couper',    role: 'cut'       },
      { label: 'Copier',    role: 'copy'      },
      { label: 'Coller',    role: 'paste'     },
      { label: 'Tout sélectionner', role: 'selectAll' },
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

/* ═══ FILE DIALOGS ═══ */
async function menuOpen() {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un projet',
    filters: [
      { name: 'Projet Devis BTP', extensions: ['json', 'devis'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!r.canceled && r.filePaths[0]) sendFileToRenderer(r.filePaths[0]);
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

/* ── Save ── */
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

/* ── Backup ── */
ipcMain.handle('file:saveBackup', async (_, { content, currentPath }) => {
  if (!currentPath) return null;
  const bp = path.join(
    path.dirname(currentPath),
    path.basename(currentPath, path.extname(currentPath)) + '.backup.json'
  );
  try { fs.writeFileSync(bp, content, 'utf-8'); return bp; }
  catch (e) { console.error('[backup]', e.message); return null; }
});

/* ── Excel ── */
ipcMain.handle('dialog:saveExcel', async (_, { buffer, defaultName }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter Excel', defaultPath: defaultName || 'devis.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, Buffer.from(buffer));
  return r.filePath;
});

/* ════════════════════════════════════════════════
   PRINT — opens in default browser
   
   The HTML is written to a temp file and opened
   with shell.openExternal(). The browser provides:
   ✓ Full print preview
   ✓ Printer selection
   ✓ Margins, orientation, copies, page range
   ✓ Print to PDF option (built into browser)
   ✓ All CSS/colors preserved
   No Electron window management needed at all.
════════════════════════════════════════════════ */
const TEMP_PRINT = path.join(os.tmpdir(), 'devis_print.html');

ipcMain.handle('file:print', async (_, { html }) => {
  try {
    fs.writeFileSync(TEMP_PRINT, html, 'utf-8');
    // Open in default browser — user gets full native print dialog
    await shell.openExternal('file://' + TEMP_PRINT);
    return true;
  } catch (e) {
    dialog.showErrorBox('Erreur impression', e.message);
    return false;
  }
});

/* ════════════════════════════════════════════════
   PDF — printToPDF on a hidden BrowserWindow
   Loads the HTML as file:// → all CSS loads correctly
   → printToPDF captures the fully styled page
════════════════════════════════════════════════ */
const TEMP_PDF = path.join(os.tmpdir(), 'devis_pdf_render.html');

ipcMain.handle('file:exportPdf', async (_, { html, defaultName }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter en PDF', defaultPath: defaultName || 'devis.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled) return null;

  // Write to temp file so it loads as file:// (reliable CSS)
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

    // Small delay to ensure all rendering (fonts, layout) is complete
    await new Promise(res => setTimeout(res, 500));

    const pdfData = await pdfWin.webContents.printToPDF({
      printBackground: true,
      // Page size & margins come from @page rule in the HTML
    });

    pdfWin.close();
    try { fs.unlinkSync(TEMP_PDF); } catch(e) {}

    fs.writeFileSync(r.filePath, pdfData);
    shell.openPath(r.filePath); // open PDF in default viewer
    return r.filePath;
  } catch (e) {
    pdfWin.close();
    try { fs.unlinkSync(TEMP_PDF); } catch(err) {}
    dialog.showErrorBox('Erreur PDF', e.message);
    return null;
  }
});

/* ═══ ABOUT ═══ */
function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info', title: 'Devis BTP',
    message: 'Devis BTP — DQE / BPU\nVersion 1.0.0',
    detail: 'Application de gestion de devis BTP.\nDinar Algérien (DA)',
    buttons: ['OK'],
  });
}
