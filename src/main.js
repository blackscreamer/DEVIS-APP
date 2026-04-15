/**
 * main.js — Electron Main Process
 *
 * Handles:
 *  1. File association  — .json/.devis files open directly in this app (Windows registry via electron-builder)
 *  2. Backup IPC        — renderer triggers backup write every 5min, saved next to the project file
 *  3. PDF export        — printToPDF with background colors, no Chrome dialog, no header/footer
 *  4. Silent print      — sends directly to default printer, no preview, no settings
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = process.argv.includes('--dev');

/* ═══════════════════════════════════════════
   FILE ASSOCIATION — grab file from OS/CLI
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

// macOS: OS fires this when the user double-clicks a registered file
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openFilePath = filePath;
  if (mainWindow) sendFileToRenderer(filePath);
});

/* ═══════════════════════════════════════════
   SINGLE INSTANCE — Windows second-instance with file
═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   WINDOW
═══════════════════════════════════════════ */
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

  // Send the associated file once renderer is ready
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

/* ═══════════════════════════════════════════
   MENU
═══════════════════════════════════════════ */
function buildMenu() {
  const send = (ch, ...args) => mainWindow.webContents.send(ch, ...args);
  const template = [
    { label: 'Fichier', submenu: [
      { label: 'Nouveau',             accelerator: 'CmdOrCtrl+N',       click: () => send('menu:new')           },
      { type: 'separator' },
      { label: 'Ouvrir…',            accelerator: 'CmdOrCtrl+O',       click: menuOpen                         },
      { label: 'Sauvegarder',        accelerator: 'CmdOrCtrl+S',       click: () => send('menu:save')          },
      { label: 'Sauvegarder sous…',  accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:saveAs')        },
      { type: 'separator' },
      { label: 'Importer Excel…',    click: menuImportExcel                                                     },
      { label: 'Exporter Excel…',    accelerator: 'CmdOrCtrl+E',       click: () => send('menu:exportExcel')   },
      { label: 'Exporter PDF…',      accelerator: 'CmdOrCtrl+Shift+E', click: () => send('menu:exportPdf')     },
      { label: 'Imprimer',           accelerator: 'CmdOrCtrl+Shift+P', click: () => send('menu:print')         },
      { type: 'separator' },
      { label: 'Quitter',            accelerator: 'CmdOrCtrl+Q',       role: 'quit'                            },
    ]},
    { label: 'Édition', submenu: [
      { label: 'Annuler',            accelerator: 'CmdOrCtrl+Z',       click: () => send('menu:undo')          },
      { label: 'Rétablir',           accelerator: 'CmdOrCtrl+Y',       click: () => send('menu:redo')          },
      { type: 'separator' },
      { label: 'Couper',    role: 'cut'       },
      { label: 'Copier',    role: 'copy'      },
      { label: 'Coller',    role: 'paste'     },
      { label: 'Tout sélectionner', role: 'selectAll' },
    ]},
    { label: 'Affichage', submenu: [
      { label: 'Mode DQE', click: () => send('menu:mode','DQE') },
      { label: 'Mode BPU', click: () => send('menu:mode','BPU') },
      { type: 'separator' },
      { label: 'Afficher / Masquer les prix', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('menu:togglePrices') },
      { type: 'separator' },
      { label: 'Réduire tout',    click: () => send('menu:collapseAll', true)  },
      { label: 'Développer tout', click: () => send('menu:collapseAll', false) },
      { type: 'separator' },
      { label: 'Recharger',     accelerator: 'F5',           role: 'reload'           },
      { label: 'Outils de dev', accelerator: 'F12',          role: 'toggleDevTools'   },
      { label: 'Plein écran',   accelerator: 'F11',          role: 'togglefullscreen' },
      { label: 'Zoom +',        accelerator: 'CmdOrCtrl+=',  role: 'zoomIn'           },
      { label: 'Zoom -',        accelerator: 'CmdOrCtrl+-',  role: 'zoomOut'          },
      { label: 'Zoom 100%',     accelerator: 'CmdOrCtrl+0',  role: 'resetZoom'        },
    ]},
    { label: 'Aide', submenu: [
      { label: 'À propos',      click: showAbout },
      { label: 'Code source',   click: () => shell.openExternal('https://github.com/blackscreamer/DEVIS-APP') },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ═══════════════════════════════════════════
   FILE DIALOGS
═══════════════════════════════════════════ */
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

// Save project
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

// Save As
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

// ── BACKUP — same dir as project file, basename.backup.json ──
ipcMain.handle('file:saveBackup', async (_, { content, currentPath }) => {
  if (!currentPath) return null;
  const backupPath = path.join(
    path.dirname(currentPath),
    path.basename(currentPath, path.extname(currentPath)) + '.backup.json'
  );
  try {
    fs.writeFileSync(backupPath, content, 'utf-8');
    return backupPath;
  } catch (e) {
    console.error('[backup] failed:', e.message);
    return null;
  }
});

// Save Excel buffer
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
   PDF EXPORT
   - printToPDF preserves all CSS background colors
   - No Chrome print dialog, no headers/footers
   - Opens in default PDF viewer after export
═══════════════════════════════════════════ */
ipcMain.handle('file:exportPdf', async (_, { defaultName }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter en PDF',
    defaultPath: defaultName || 'devis.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled) return null;
  try {
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground:     true,
      pageSize:            'A4',
      landscape:           false,
      displayHeaderFooter: false,
      headerTemplate:      '',
      footerTemplate:      '',
      margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });
    fs.writeFileSync(r.filePath, pdfData);
    shell.openPath(r.filePath);
    return r.filePath;
  } catch (e) {
    dialog.showErrorBox('Erreur PDF', e.message);
    return null;
  }
});

/* ═══════════════════════════════════════════
   SILENT PRINT
   - Sends directly to default printer
   - No preview window, no margin/paper dialogs
   - printBackground: true → colors preserved
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   SILENT PRINT
   - silent: true  → skip print dialog, send to default printer
   - printBackground: true → preserve all cell colors
   NOTE: requires a default printer to be set on the system.
         If no printer is found, shows error dialog instead of crashing.
═══════════════════════════════════════════ */
ipcMain.handle('file:print', () => new Promise(resolve => {
  // Check if any printer is available first
  mainWindow.webContents.getPrintersAsync().then(printers => {
    if (!printers || printers.length === 0) {
      dialog.showErrorBox('Impression', 'Aucune imprimante détectée sur ce système.');
      resolve(false);
      return;
    }
    // Find default printer or use first available
    const defaultPrinter = printers.find(p => p.isDefault) || printers[0];

    mainWindow.webContents.print(
      {
        silent:          true,
        printBackground: true,
        deviceName:      defaultPrinter.name,
        pageSize:        'A4',
        landscape:       false,
        margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      },
      (success, errorType) => {
        if (!success) {
          console.error('[print] failed:', errorType);
          dialog.showErrorBox('Erreur impression', `Échec: ${errorType}\nImprimante: ${defaultPrinter.name}`);
        }
        resolve(success);
      }
    );
  }).catch(err => {
    console.error('[print] getPrinters failed:', err.message);
    // Fallback: try without deviceName
    mainWindow.webContents.print(
      { silent: true, printBackground: true, pageSize: 'A4' },
      (success) => resolve(success)
    );
  });
}));

/* ═══════════════════════════════════════════
   ABOUT
═══════════════════════════════════════════ */
function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info', title: 'Devis BTP',
    message: 'Devis BTP — DQE / BPU\nVersion 1.0.0',
    detail:  'Application de gestion de devis BTP.\nFormat DQE et BPU — Dinar Algérien (DA)',
    buttons: ['OK'],
  });
}
