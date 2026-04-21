/**
 * init.js — Démarrage de l'application.
 * Chargé en dernier — tous les modules sont disponibles.
 */

window.onload = () => {
  let loaded = false;
  try { loaded = loadLocal(); } catch(e) { console.warn('loadLocal error:', e); }

  if (!loaded) {
    rows = [];
    // Ensure headerLines is initialized
    if (!Array.isArray(headerLines) || !headerLines.length) {
      headerLines = [{ text: '', style: 't1' }, { text: '', style: 't2' }];
    }
  }

  render();
  if (loaded) notif('✓ Données restaurées');

  snapshot();
  setMode(mode);
  applyPricesUI();
  updateWorkspaceSize();
  applyStoredColWidths();
  syncColWidthUI();
  renderHeaderLines();
  syncSearchUI();
};
