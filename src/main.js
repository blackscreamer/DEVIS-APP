/**
 * main.js — Electron Main Process
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

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
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = getFileFromArgs(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (filePath) sendFileToRenderer(filePath);
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

function sendFileToRenderer(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    mainWindow.webContents.send('file:opened', { path: filePath, content });
    mainWindow.setTitle(path.basename(filePath, path.extname(filePath)) + ' — Devis BTP');
  } catch (e) {
    dialog.showErrorBox('Erreur ouverture', `Impossible d'ouvrir :\n${filePath}\n\n${e.message}`);
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

/* ═══ MENU ═══ */
function buildMenu() {
  const send = (ch, ...args) => mainWindow.webContents.send(ch, ...args);
  const template = [
    { label: 'Fichier', submenu: [
      { label: 'Nouveau',            accelerator: 'CmdOrCtrl+N',       click: () => send('menu:new')           },
      { type: 'separator' },
      { label: 'Ouvrir…',           accelerator: 'CmdOrCtrl+O',       click: menuOpen                         },
      { label: 'Sauvegarder',       accelerator: 'CmdOrCtrl+S',       click: () => send('menu:save')          },
      { label: 'Sauvegarder sous…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:saveAs')        },
      { type: 'separator' },
      { label: 'Importer Excel…',   click: menuImportExcel                                                     },
      { label: 'Exporter Excel…',   accelerator: 'CmdOrCtrl+E',       click: () => send('menu:exportExcel')   },
      { label: 'Exporter PDF…',     accelerator: 'CmdOrCtrl+Shift+E', click: () => send('menu:exportPdf')     },
      { label: 'Imprimer…',         accelerator: 'CmdOrCtrl+P',       click: () => send('menu:print')         },
      { type: 'separator' },
      { label: 'Quitter',           accelerator: 'CmdOrCtrl+Q',       role: 'quit'                            },
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
      { label: 'Afficher / Masquer les prix', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('menu:togglePrices') },
      { type: 'separator' },
      { label: 'Réduire tout',    click: () => send('menu:collapseAll', true)  },
      { label: 'Développer tout', click: () => send('menu:collapseAll', false) },
      { type: 'separator' },
      { label: 'Recharger',     accelerator: 'F5',          role: 'reload'           },
      { label: 'Outils de dev', accelerator: 'F12',         role: 'toggleDevTools'   },
      { label: 'Plein écran',   accelerator: 'F11',         role: 'togglefullscreen' },
      { label: 'Zoom +',        accelerator: 'CmdOrCtrl+=', role: 'zoomIn'           },
      { label: 'Zoom -',        accelerator: 'CmdOrCtrl+-', role: 'zoomOut'          },
      { label: 'Zoom 100%',     accelerator: 'CmdOrCtrl+0', role: 'resetZoom'        },
    ]},
    { label: 'Aide', submenu: [
      { label: 'À propos',    click: showAbout                                                              },
      { label: 'Code source', click: () => shell.openExternal('https://github.com/blackscreamer/DEVIS-APP') },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
  if (!r.canceled && r.filePaths[0]) {
    mainWindow.webContents.send('file:importExcel', fs.readFileSync(r.filePaths[0]));
  }
}

ipcMain.handle('dialog:save', async (_, { content, defaultName, currentPath }) => {
  let savePath = currentPath;
  if (!savePath) {
    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Sauvegarder',
      defaultPath: defaultName || 'devis.json',
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
    title: 'Sauvegarder sous…',
    defaultPath: defaultName || 'devis.json',
    filters: [{ name: 'Projet Devis BTP', extensions: ['json'] }],
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, content, 'utf-8');
  mainWindow.setTitle(path.basename(r.filePath, path.extname(r.filePath)) + ' — Devis BTP');
  return r.filePath;
});

ipcMain.handle('file:saveBackup', async (_, { content, currentPath }) => {
  if (!currentPath) return null;
  const backupPath = path.join(
    path.dirname(currentPath),
    path.basename(currentPath, path.extname(currentPath)) + '.backup.json'
  );
  try { fs.writeFileSync(backupPath, content, 'utf-8'); return backupPath; }
  catch (e) { console.error('[backup] failed:', e.message); return null; }
});

ipcMain.handle('dialog:saveExcel', async (_, { buffer, defaultName }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter Excel',
    defaultPath: defaultName || 'devis.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, Buffer.from(buffer));
  return r.filePath;
});

/* ═══════════════════════════════════════════
   PRINT — opens a dedicated print window
   
   Strategy: renderer sends us the full page HTML (already rendered,
   with inline CSS + print settings applied). We create a hidden
   BrowserWindow, load that HTML, then call window.print() inside it.
   This triggers the native OS print dialog WITH preview, printer
   selection, and all standard print settings.
   
   The user sees: printer list + preview + margins/copies/etc.
   Colors are preserved because we inject print-color-adjust:exact.
═══════════════════════════════════════════ */
ipcMain.handle('file:print', async (_, { html }) => {
  return new Promise((resolve) => {
    // Create invisible print window
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Load the prepared HTML string
    printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    printWin.webContents.once('did-finish-load', () => {
      // Show the window briefly so print dialog renders correctly
      // then trigger print — this opens the native OS print dialog
      printWin.webContents.print(
        {
          silent: false,          // ← show OS print dialog with preview
          printBackground: true,  // preserve cell colors
        },
        (success, errorType) => {
          printWin.close();
          resolve(success);
        }
      );
    });

    printWin.on('closed', () => resolve(false));
  });
});

/* ═══════════════════════════════════════════
   PDF EXPORT — printToPDF, no Chrome dialog
═══════════════════════════════════════════ */
ipcMain.handle('file:exportPdf', async (_, { html, defaultName }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter en PDF',
    defaultPath: defaultName || 'devis.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled) return null;

  // Create hidden window to render the print HTML
  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await new Promise(res => {
      pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      pdfWin.webContents.once('did-finish-load', res);
    });

    const pdfData = await pdfWin.webContents.printToPDF({
      printBackground:     true,
      pageSize:            'A4',
      landscape:           false,
      displayHeaderFooter: false,
      headerTemplate:      '',
      footerTemplate:      '',
      margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });

    fs.writeFileSync(r.filePath, pdfData);
    pdfWin.close();
    shell.openPath(r.filePath);
    return r.filePath;
  } catch (e) {
    pdfWin.close();
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
