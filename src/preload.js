const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveProject:   (content, defaultName, currentPath) => ipcRenderer.invoke('dialog:save',     { content, defaultName, currentPath }),
  saveProjectAs: (content, defaultName)              => ipcRenderer.invoke('dialog:saveAs',   { content, defaultName }),
  saveBackup:    (content, currentPath)              => ipcRenderer.invoke('file:saveBackup', { content, currentPath }),
  saveExcel:     (buffer, defaultName)               => ipcRenderer.invoke('dialog:saveExcel',{ buffer, defaultName }),
  // print and exportPdf receive the full page HTML string
  printDoc:      (html)                              => ipcRenderer.invoke('file:print',      { html }),
  exportPdf:     (html, defaultName)                 => ipcRenderer.invoke('file:exportPdf',  { html, defaultName }),

  onMenuNew:          cb => ipcRenderer.on('menu:new',          () => cb()),
  onMenuSave:         cb => ipcRenderer.on('menu:save',         () => cb()),
  onMenuSaveAs:       cb => ipcRenderer.on('menu:saveAs',       () => cb()),
  onMenuExportExcel:  cb => ipcRenderer.on('menu:exportExcel',  () => cb()),
  onMenuExportPdf:    cb => ipcRenderer.on('menu:exportPdf',    () => cb()),
  onMenuPrint:        cb => ipcRenderer.on('menu:print',        () => cb()),
  onMenuTogglePrices: cb => ipcRenderer.on('menu:togglePrices', () => cb()),
  onMenuMode:         cb => ipcRenderer.on('menu:mode',         (_, m) => cb(m)),
  onMenuCollapseAll:  cb => ipcRenderer.on('menu:collapseAll',  (_, v) => cb(v)),
  onMenuUndo:         cb => ipcRenderer.on('menu:undo',         () => cb()),
  onMenuRedo:         cb => ipcRenderer.on('menu:redo',         () => cb()),
  onFileOpened:       cb => ipcRenderer.on('file:opened',       (_, data) => cb(data)),
  onFileImportExcel:  cb => ipcRenderer.on('file:importExcel',  (_, buf)  => cb(buf)),

  isElectron: true,
});
