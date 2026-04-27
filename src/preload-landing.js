/**
 * preload-landing.js — Pont sécurisé pour la fenêtre landing.
 */
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('landingAPI', {
  newFile:         (mode)     => ipcRenderer.invoke('landing:new',          mode),
  openFile:        ()         => ipcRenderer.invoke('landing:open'),
  openRecent:      (filePath) => ipcRenderer.invoke('landing:openRecent',   filePath),
  removeRecent:    (filePath) => ipcRenderer.invoke('landing:removeRecent', filePath),
  openExternal:    (url)      => shell.openExternal(url),
  onRecentsUpdated:(cb)       => ipcRenderer.on('recents:updated', (_, list) => cb(list)),
});
