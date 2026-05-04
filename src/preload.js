/**
 * preload.js — Pont sécurisé main ↔ renderer (editor).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /* ── File operations ── */
  saveProject:    (content, defaultName, currentPath) => ipcRenderer.invoke('dialog:save',      { content, defaultName, currentPath }),
  saveProjectAs:  (content, defaultName)              => ipcRenderer.invoke('dialog:saveAs',    { content, defaultName }),
  saveBackup:     (content, currentPath)              => ipcRenderer.invoke('file:saveBackup',  { content, currentPath }),
  saveExcel:      (buffer, defaultName)               => ipcRenderer.invoke('dialog:saveExcel', { buffer, defaultName }),
  printInBrowser: (html)                              => ipcRenderer.invoke('file:print',        { html }),

  /* ── Dirty state — tells main if there are unsaved changes ── */
  setDirty: (dirty) => ipcRenderer.send('dirty:update', dirty),

  /* ── Menu events → renderer ── */
  onMenuNew:          cb => ipcRenderer.on('menu:new',          () => cb()),
  onProjectNew:       cb => ipcRenderer.on('project:new',       (_, m) => cb(m)),
  onMenuSave:         cb => ipcRenderer.on('menu:save',         () => cb()),
  onMenuSaveAs:       cb => ipcRenderer.on('menu:saveAs',       () => cb()),
  onMenuExportExcel:  cb => ipcRenderer.on('menu:exportExcel',  () => cb()),
  onMenuPrint:        cb => ipcRenderer.on('menu:print',        () => cb()),
  onMenuTogglePrices: cb => ipcRenderer.on('menu:togglePrices', () => cb()),
  onMenuMode:         cb => ipcRenderer.on('menu:mode',         (_, m) => cb(m)),
  onMenuCollapseAll:  cb => ipcRenderer.on('menu:collapseAll',  (_, v) => cb(v)),
  onMenuUndo:         cb => ipcRenderer.on('menu:undo',         () => cb()),
  onMenuRedo:         cb => ipcRenderer.on('menu:redo',         () => cb()),
  onFileOpened:       cb => ipcRenderer.on('file:opened',       (_, d) => cb(d)),
  onFileImportExcel:  cb => ipcRenderer.on('file:importExcel',  (_, b) => cb(b)),

  isElectron: true,
});
