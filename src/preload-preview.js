/**
 * preload-preview.js — Pont pour la fenêtre de prévisualisation.
 * Expose uniquement les actions impression/PDF/fermeture.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('previewAPI', {
  print:     ()            => ipcRenderer.invoke('preview:print'),
  exportPdf: (defaultName) => ipcRenderer.invoke('preview:exportPdf', { defaultName }),
  close:     ()            => ipcRenderer.invoke('preview:close'),
});
