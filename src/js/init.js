/**
 * init.js — Démarrage de l'application.
 * Chargé en dernier — tous les modules sont disponibles.
 *
 * Stratégie:
 * - Toujours démarrer avec un projet vierge (pas de loadLocal au démarrage)
 * - Si l'app est ouverte depuis la landing avec "Nouveau" → onProjectNew() charge le mode
 * - Si l'app est ouverte depuis la landing avec un fichier → onFileOpened() charge les données
 * - Si l'app est rechargée (F5 en dev) → loadLocal() restaure le dernier état
 *
 * On distingue les cas via sessionStorage:
 *   'devis_origin' = 'new'  → projet vierge, ne pas charger localStorage
 *   'devis_origin' = 'file' → fichier chargé via IPC, ne pas charger localStorage
 *   absent/autre            → rechargement dev → charger localStorage
 */

window.onload = () => {
  const origin = sessionStorage.getItem('devis_origin');

  if (!origin) {
    // Rechargement direct (F5 en dev) — restaurer depuis localStorage
    let loaded = false;
    try { loaded = loadLocal(); } catch(e) { console.warn('loadLocal:', e); }
    if (!loaded) {
      rows = [];
      if (!Array.isArray(headerLines) || !headerLines.length)
        headerLines = [{ text:'', style:'t1' }, { text:'', style:'t2' }];
    }
    render();
    if (loaded) notif('✓ Session restaurée');
  } else {
    // Venu de la landing page → démarrer vierge, laisser IPC peupler
    rows = [];
    headerLines = [{ text:'', style:'t1' }, { text:'', style:'t2' }];
    render();
    // Nettoyer le flag pour que F5 restaure ensuite
    sessionStorage.removeItem('devis_origin');
  }

  snapshot();
  setMode(mode);
  applyPricesUI();
  updateWorkspaceSize();
  applyStoredColWidths();
  syncColWidthUI();
  renderHeaderLines();
  syncSearchUI();
};
