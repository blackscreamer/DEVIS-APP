/**
 * ui.js — Helpers d'interface mineurs.
 */

/** Met à jour l'indicateur autosave */
function setSaveIndicator(state) {
  const ind = document.getElementById('save-ind');
  if (!ind) return;
  ind.className = state;
  if (state === 'saved')    ind.innerHTML = '<i class="bi bi-cloud-check"></i> Sauvegardé';
  else if (state === 'error') ind.innerHTML = '<i class="bi bi-exclamation-circle"></i> Erreur';
  else                      ind.innerHTML = '<i class="bi bi-cloud-check"></i> Auto';
}

/** Adapte dynamiquement la hauteur de tous les textareas après un resize fenêtre */
window.addEventListener('resize', () => {
  document.querySelectorAll('textarea.di').forEach(t => ar(t));
  if (selId) {
    const tr = document.getElementById('ro-' + selId);
    if (tr) positionFloatCtrl(tr);
  }
});
