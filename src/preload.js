/**
 * preload.js — Pont sécurisé entre le processus principal (main.js)
 * et le renderer (index.html / app.js).
 *
 * Seules les fonctions explicitement exposées ici sont accessibles
 * depuis le renderer via window.electronAPI.*
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  /* ── Fichiers ── */
  // Sauvegarder (écrase si path connu, sinon dialogue)
  saveProject:  (content, defaultName, currentPath) =>
    ipcRenderer.invoke('dialog:save', { content, defaultName, currentPath }),

  // Toujours ouvrir le dialogue "sauvegarder sous"
  saveProjectAs: (content, defaultName) =>
    ipcRenderer.invoke('dialog:saveAs', { content, defaultName }),

  // Sauvegarder un buffer Excel
  saveExcel: (buffer, defaultName) =>
    ipcRenderer.invoke('dialog:saveExcel', { buffer, defaultName }),

  /* ── Événements depuis le menu natif → renderer ── */
  onMenuNew:          cb => ipcRenderer.on('menu:new',          () => cb()),
  onMenuSave:         cb => ipcRenderer.on('menu:save',         () => cb()),
  onMenuSaveAs:       cb => ipcRenderer.on('menu:saveAs',       () => cb()),
  onMenuExportExcel:  cb => ipcRenderer.on('menu:exportExcel',  () => cb()),
  onMenuTogglePrices: cb => ipcRenderer.on('menu:togglePrices', () => cb()),
  onMenuMode:         cb => ipcRenderer.on('menu:mode',         (_, m) => cb(m)),
  onMenuCollapseAll:  cb => ipcRenderer.on('menu:collapseAll',  (_, v) => cb(v)),
  onMenuUndo:         cb => ipcRenderer.on('menu:undo',         () => cb()),
  onMenuRedo:         cb => ipcRenderer.on('menu:redo',         () => cb()),

  /* ── Fichier ouvert via menu Fichier > Ouvrir ── */
  onFileOpened:       cb => ipcRenderer.on('file:opened',       (_, data) => cb(data)),
  onFileImportExcel:  cb => ipcRenderer.on('file:importExcel',  (_, buf)  => cb(buf)),

  /* ── Utilitaires ── */
  isElectron: true,
});
