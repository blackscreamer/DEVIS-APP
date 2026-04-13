/**
 * files.js — Sauvegarde et chargement des projets.
 * Utilise l'API Electron (window.electronAPI) si disponible,
 * sinon tombe en mode navigateur (download / FileReader).
 */

const isElectron = !!(window.electronAPI);

/* ── Données à sauvegarder ── */
function getSaveData() {
  return {
    v: 8,
    rows, mode, nid, C, showPrices,
    tva: document.getElementById('tva').value,
    l1:  document.getElementById('hl1').value,
    l2:  document.getElementById('hl2').value,
    l3:  document.getElementById('hl3').value,
  };
}

/* ── Appliquer les données chargées ── */
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

/* ── Autosave localStorage (debounced 500ms) ── */
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

/* ── Sauvegarder ── */
async function fileSave(saveAs) {
  const data     = getSaveData();
  const json     = JSON.stringify(data, null, 2);
  const defName  = (data.l1 || 'devis').replace(/\s+/g, '_').substring(0, 40) + '.json';

  if (isElectron) {
    const path = saveAs
      ? await window.electronAPI.saveProjectAs(json, defName)
      : await window.electronAPI.saveProject(json, defName, currentFilePath);
    if (path) {
      currentFilePath = path;
      updateFileLabel(path);
      notif('✓ Fichier sauvegardé');
      saveLocal();
    }
  } else {
    // Navigateur — download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = defName; a.click();
    notif('✓ Fichier téléchargé');
  }
}

/* ── Ouvrir via input[type=file] (navigateur) ── */
function importProjectFile(inp) {
  const f = inp.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!d.rows) throw 0;
      applyLoadedData(d);
      currentFilePath = null;
      updateFileLabel('');
      render(); snapshot(); saveLocal();
      notif('✓ Projet chargé');
    } catch { notif('⚠ Fichier invalide'); }
  };
  reader.readAsText(f);
  inp.value = '';
}

/* ── Mettre à jour le label du fichier courant en pied de page ── */
function updateFileLabel(path) {
  const el = document.getElementById('current-file-label');
  if (el) el.textContent = path ? '📄 ' + path.split(/[\\/]/).pop() : '';
}

/* ── Autosave fichier toutes les 5 min (Electron) ── */
if (isElectron) {
  setInterval(async () => {
    if (currentFilePath) {
      const data = getSaveData();
      const path = await window.electronAPI.saveProject(JSON.stringify(data, null, 2), '', currentFilePath);
      if (path) {
        const ind = document.getElementById('save-ind');
        ind.classList.add('saved');
        ind.innerHTML = '<i class="bi bi-cloud-check"></i> Auto-saved';
        setTimeout(() => { ind.classList.remove('saved'); ind.innerHTML = '<i class="bi bi-cloud-check"></i> Auto'; }, 2000);
      }
    }
  }, AUTOSAVE_FILE_MS);

  /* Écoute des événements menu Electron */
  window.electronAPI.onMenuNew(()     => { if (confirm('Nouveau projet ? Les modifications non sauvegardées seront perdues.')) { rows=[]; nid=1; currentFilePath=null; updateFileLabel(''); render(); snapshot(); } });
  window.electronAPI.onMenuSave(()    => fileSave(false));
  window.electronAPI.onMenuSaveAs(()  => fileSave(true));
  window.electronAPI.onMenuUndo(()    => undo());
  window.electronAPI.onMenuRedo(()    => redo());
  window.electronAPI.onMenuMode(m     => setMode(m));
  window.electronAPI.onMenuCollapseAll(v => collapseAll(v));
  window.electronAPI.onMenuTogglePrices(() => togglePrices());
  window.electronAPI.onMenuExportExcel(()  => doExport());

  window.electronAPI.onFileOpened(({ path, content }) => {
    try {
      const d = JSON.parse(content);
      if (!d.rows) throw 0;
      applyLoadedData(d);
      currentFilePath = path;
      updateFileLabel(path);
      render(); snapshot(); saveLocal();
      notif('✓ Projet chargé');
    } catch { notif('⚠ Fichier invalide'); }
  });

  window.electronAPI.onFileImportExcel(buf => importExcelBuffer(buf));
}
