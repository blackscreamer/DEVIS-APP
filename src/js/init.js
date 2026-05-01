/**
 * init.js — Initialisation de l'application.
 *
 * Stratégie de démarrage :
 *
 * ?new=DQE ou ?new=BPU dans l'URL
 *   → Vient de la landing "Nouveau projet"
 *   → Démarrer vierge, NE PAS charger localStorage
 *   → Appliquer le mode passé en paramètre
 *
 * Pas de query string (URL = file:///…/index.html)
 *   → Rechargement direct (F5 dev) OU ouverture depuis landing avec un fichier
 *   → Charger localStorage pour restaurer le dernier état
 *   → Si un fichier est envoyé via IPC (onFileOpened), il écrase le localStorage
 *
 * Ce mécanisme est fiable car la query string est disponible
 * IMMÉDIATEMENT dans window.onload, avant tout IPC.
 */

window.onload = () => {
  const params  = new URLSearchParams(window.location.search);
  const newMode = params.get('new'); // 'DQE', 'BPU', or null

  if (newMode) {
    /* ── Nouveau projet depuis la landing ── */
    rows        = [];
    nid         = 1;
    showPrices  = true;
    headerLines = [{ text: '', style: 't1' }, { text: '', style: 't2' }];
    currentFilePath = null;
    Object.assign(pageLayout, {
      size:'A4', orient:'portrait', mt:15, mb:15, ml:15, mr:15,
      header:'', footer:'', showPageNum:true, showDate:false,
    });
    // Clear localStorage so F5 doesn't restore old project
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  } else {
    /* ── Rechargement ou ouverture fichier ── */
    let loaded = false;
    try { loaded = loadLocal(); } catch(e) { console.warn('loadLocal:', e); }
    if (!loaded) {
      rows = [];
      if (!Array.isArray(headerLines) || !headerLines.length)
        headerLines = [{ text:'', style:'t1' }, { text:'', style:'t2' }];
    }
    if (loaded) notif('✓ Session restaurée');
  }

  render();
  snapshot();

  // Apply mode: from URL param or from loaded state
  setMode(newMode || mode);
  applyPricesUI();
  updateWorkspaceSize();
  applyStoredColWidths();
  syncColWidthUI();
  renderHeaderLines();
  syncSearchUI();

  if (newMode) notif('✓ Nouveau projet ' + newMode);
};
