/**
 * init.js — Démarrage de l'application.
 * Ce fichier est chargé en dernier — tous les modules sont déjà disponibles.
 */

window.onload = () => {
  // Restaurer depuis localStorage si disponible
  if (!loadLocal()) {
    rows = [];
    render();
  } else {
    render();
    notif('✓ Données restaurées');
  }

  // Premier snapshot undo
  snapshot();

  // Afficher le mode courant dans le menu
  setMode(mode);
  applyPricesUI();
};

// Apply A4 workspace dimensions after init
window.addEventListener('load', () => {
  if (typeof updateWorkspaceSize  === 'function') updateWorkspaceSize();
  if (typeof applyStoredColWidths === 'function') applyStoredColWidths();
  if (typeof syncColWidthUI       === 'function') syncColWidthUI();
  if (typeof renderHeaderLines    === 'function') renderHeaderLines();
});
