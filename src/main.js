/**
 * main.js — Electron Main Process
 * Gère la fenêtre, les menus natifs, les dialogues fichier, et l'export PDF.
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path  = require('path');
const fs    = require('fs');

const isDev = process.argv.includes('--dev');

/* ═══════════════════════════════════════════
   FENÊTRE PRINCIPALE
═══════════════════════════════════════════ */
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 860,
    minWidth:  900,
    minHeight: 600,
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
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ═══════════════════════════════════════════
   MENU NATIF
═══════════════════════════════════════════ */
function buildMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { label: 'Nouveau',             accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu:new')        },
        { type: 'separator' },
        { label: 'Ouvrir…',            accelerator: 'CmdOrCtrl+O', click: () => menuOpen()                                     },
        { label: 'Sauvegarder',        accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:save')       },
        { label: 'Sauvegarder sous…',  accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu:saveAs') },
        { type: 'separator' },
        { label: 'Importer Excel…',    click: () => menuImportExcel()  },
        { label: 'Exporter Excel…',    accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('menu:exportExcel') },
        { label: 'Exporter PDF…',      accelerator: 'CmdOrCtrl+P', click: () => menuExportPdf()                                },
        { type: 'separator' },
        { label: 'Quitter',            accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { label: 'Annuler',    accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.send('menu:undo') },
        { label: 'Rétablir',   accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.send('menu:redo') },
        { type: 'separator' },
        { label: 'Couper',    role: 'cut'   },
        { label: 'Copier',    role: 'copy'  },
        { label: 'Coller',    role: 'paste' },
        { label: 'Sélectionner tout', role: 'selectAll' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { label: 'Mode DQE', click: () => mainWindow.webContents.send('menu:mode', 'DQE') },
        { label: 'Mode BPU', click: () => mainWindow.webContents.send('menu:mode', 'BPU') },
        { type: 'separator' },
        { label: 'Afficher / Masquer les prix', accelerator: 'CmdOrCtrl+Shift+P', click: () => mainWindow.webContents.send('menu:togglePrices') },
        { type: 'separator' },
        { label: 'Réduire tout',    click: () => mainWindow.webContents.send('menu:collapseAll', true)  },
        { label: 'Développer tout', click: () => mainWindow.webContents.send('menu:collapseAll', false) },
        { type: 'separator' },
        { label: 'Recharger',      accelerator: 'F5',          role: 'reload'        },
        { label: 'Outils de dev',  accelerator: 'F12',         role: 'toggleDevTools' },
        { label: 'Plein écran',    accelerator: 'F11',         role: 'togglefullscreen' },
        { label: 'Zoom +',         accelerator: 'CmdOrCtrl+=', role: 'zoomIn'        },
        { label: 'Zoom -',         accelerator: 'CmdOrCtrl+-', role: 'zoomOut'       },
        { label: 'Zoom 100%',      accelerator: 'CmdOrCtrl+0', role: 'resetZoom'     },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        { label: 'À propos', click: () => showAbout() },
        { label: 'Documentation', click: () => shell.openExternal('https://github.com') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ═══════════════════════════════════════════
   IPC — DIALOGUES FICHIERS
═══════════════════════════════════════════ */

// Ouvrir projet JSON
async function menuOpen() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un projet',
    filters: [{ name: 'Projet DQE/BPU', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths[0]) {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    mainWindow.webContents.send('file:opened', { path: result.filePaths[0], content });
  }
}

// Importer Excel
async function menuImportExcel() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importer un fichier Excel',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths[0]) {
    const buf = fs.readFileSync(result.filePaths[0]);
    mainWindow.webContents.send('file:importExcel', buf);
  }
}

// Sauvegarder — IPC depuis renderer
ipcMain.handle('dialog:save', async (_, { content, defaultName, currentPath }) => {
  let savePath = currentPath;
  if (!savePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Sauvegarder le projet',
      defaultPath: defaultName || 'devis.json',
      filters: [{ name: 'Projet DQE/BPU', extensions: ['json'] }],
    });
    if (result.canceled) return null;
    savePath = result.filePath;
  }
  fs.writeFileSync(savePath, content, 'utf-8');
  return savePath;
});

// Sauvegarder sous — toujours demander
ipcMain.handle('dialog:saveAs', async (_, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Sauvegarder sous…',
    defaultPath: defaultName || 'devis.json',
    filters: [{ name: 'Projet DQE/BPU', extensions: ['json'] }],
  });
  if (result.canceled) return null;
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return result.filePath;
});

// Exporter Excel
ipcMain.handle('dialog:saveExcel', async (_, { buffer, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter Excel',
    defaultPath: defaultName || 'devis.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (result.canceled) return null;
  fs.writeFileSync(result.filePath, Buffer.from(buffer));
  return result.filePath;
});

// Export PDF via impression Electron
async function menuExportPdf() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter en PDF',
    defaultPath: 'devis.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (result.canceled) return;
  const pdfData = await mainWindow.webContents.printToPDF({
    printBackground:    true,
    pageSize:          'A4',
    landscape:          false,
    marginsType:        1, // custom
    margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
  });
  fs.writeFileSync(result.filePath, pdfData);
  shell.openPath(result.filePath);
}

/* ═══════════════════════════════════════════
   ABOUT
═══════════════════════════════════════════ */
function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type:    'info',
    title:   'Devis BTP',
    message: 'Devis BTP — DQE / BPU Pro\nVersion 1.0.0',
    detail:  'Application de gestion de devis de construction.\nFormat DQE et BPU — Dinar Algérien (DA)',
    buttons: ['OK'],
  });
}
