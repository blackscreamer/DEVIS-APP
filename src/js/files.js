/**
 * files.js — Sauvegarde, chargement, autosave, backup.
 *
 * Backup logic:
 *   Every 5 minutes, if a project file is open, write
 *   "projectname.backup.json" in the same directory.
 *   The backup is separate from the main file so it never overwrites it.
 */

const isElectron = !!(window.electronAPI);

/* ── Données sérialisées ── */
function getSaveData() {
  return {
    v: 8, rows, mode, nid, C, showPrices,
    tva: document.getElementById('tva').value,
    l1:  document.getElementById('hl1').value,
    l2:  document.getElementById('hl2').value,
    l3:  document.getElementById('hl3').value,
  };
}

function applyLoadedData(d) {
  rows = d.rows || [];
  nid  = d.nid  || 1;
  if (d.C) C = d.C;
  document.getElementById('tva').value = d.tva || 19;
  document.getElementById('hl1').value = d.l1  || '';
  document.getElementById('hl2').value = d.l2  || '';
  document.getElementById('hl3').value = d.l3  || '';
  if (d.showPrices !== undefined) { showPrices = d.showPrices; applyPricesUI(); }
  setMode(d.mode || 'DQE');
}

/* ── Autosave localStorage (debounced) ── */
function triggerAutosave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveLocal, AUTOSAVE_DELAY);
}
function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveData())); } catch (e) {}
}
function loadLocal() {
  const str = localStorage.getItem(STORAGE_KEY);
  if (!str) return false;
  try { applyLoadedData(JSON.parse(str)); return true; } catch { return false; }
}

/* ── Sauvegarder projet (Ctrl+S / menu) ── */
async function fileSave(saveAs) {
  const data    = getSaveData();
  const json    = JSON.stringify(data, null, 2);
  const defName = (data.l1 || 'devis').replace(/\s+/g,'_').substring(0,40) + '.json';

  if (isElectron) {
    const savedPath = saveAs
      ? await window.electronAPI.saveProjectAs(json, defName)
      : await window.electronAPI.saveProject(json, defName, currentFilePath);
    if (savedPath) {
      currentFilePath = savedPath;
      updateFileLabel(savedPath);
      setSaveIndicator('saved');
      setTimeout(() => setSaveIndicator(''), 2000);
      saveLocal();
      notif('✓ Projet sauvegardé');
    }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = defName; a.click();
    notif('✓ Fichier téléchargé');
  }
}

/* ── Backup automatique toutes les 5 minutes ──
   Écrit projectname.backup.json dans le même répertoire que le fichier projet.
   Ne touche jamais au fichier principal.                                       */
function startBackupTimer() {
  setInterval(async () => {
    if (!currentFilePath) return;
    const json = JSON.stringify(getSaveData(), null, 2);
    const backupPath = await window.electronAPI.saveBackup(json, currentFilePath);
    if (backupPath) {
      const ind = document.getElementById('save-ind');
      if (ind) {
        const prev = ind.innerHTML;
        ind.innerHTML = '<i class="bi bi-shield-check"></i> Backup';
        ind.classList.add('saved');
        setTimeout(() => { ind.innerHTML = prev; ind.classList.remove('saved'); }, 2000);
      }
    }
  }, AUTOSAVE_FILE_MS); // 5 min, défini dans constants.js
}

/* ── Label fichier courant ── */
function updateFileLabel(filePath) {
  const el = document.getElementById('current-file-label');
  if (el) el.textContent = filePath ? '📄 ' + filePath.split(/[\\/]/).pop() : '';
}

/* ── PDF export ── */
async function doExportPdf() {
  const data    = getSaveData();
  const defName = (data.l1 || 'devis').replace(/\s+/g,'_').substring(0,40) + '.pdf';
  if (isElectron) {
    const p = await window.electronAPI.exportPdf(defName);
    if (p) notif('✓ PDF exporté');
  } else {
    window.print();
  }
}

/* ── Impression silencieuse — envoie directement à l'imprimante par défaut ── */
async function doPrint() {
  if (isElectron) {
    notif('🖨 Impression en cours…');
    const ok = await window.electronAPI.printSilent();
    notif(ok ? '✓ Document envoyé à l\'imprimante' : '⚠ Erreur impression');
  } else {
    // En mode navigateur : avertissement — pas d'impression silencieuse possible
    notif('⚠ Impression silencieuse disponible uniquement dans l\'app Electron');
  }
}

/* ── Wiring Electron events ── */
if (isElectron) {

  // Start the 5-minute backup timer
  startBackupTimer();

  window.electronAPI.onMenuNew(() => {
    if (confirm('Nouveau projet ? Les modifications non sauvegardées seront perdues.')) {
      rows = []; nid = 1; currentFilePath = null;
      updateFileLabel('');
      render(); snapshot(); saveLocal();
    }
  });

  window.electronAPI.onMenuSave(()        => fileSave(false));
  window.electronAPI.onMenuSaveAs(()      => fileSave(true));
  window.electronAPI.onMenuExportExcel(() => doExport());
  window.electronAPI.onMenuExportPdf(()   => doExportPdf());
  window.electronAPI.onMenuPrint(()       => doPrint());
  window.electronAPI.onMenuUndo(()        => undo());
  window.electronAPI.onMenuRedo(()        => redo());
  window.electronAPI.onMenuMode(m         => setMode(m));
  window.electronAPI.onMenuCollapseAll(v  => collapseAll(v));
  window.electronAPI.onMenuTogglePrices(()=> togglePrices());

  // File opened via OS association or menu
  window.electronAPI.onFileOpened(({ path, content }) => {
    try {
      const d = JSON.parse(content);
      if (!d.rows) throw new Error('Format invalide');
      applyLoadedData(d);
      currentFilePath = path;
      updateFileLabel(path);
      render(); snapshot(); saveLocal();
      notif('✓ ' + path.split(/[\\/]/).pop() + ' chargé');
    } catch (e) { notif('⚠ ' + e.message); }
  });

  window.electronAPI.onFileImportExcel(buf => importExcelBuffer(buf));
}
