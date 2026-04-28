/**
 * sidepanel.js — Panneau latéral fixe.
 *
 * Remplace le float-ctrl positionné dynamiquement.
 * Toujours visible, mis à jour par updateSidePanel()
 * après chaque changement de sélection — SANS render().
 *
 * Supporte la multi-sélection (Ctrl+clic, Shift+clic).
 */

/* Suppress add-here-row when any button in the side panel is clicked */
document.getElementById('side-panel').addEventListener('mousedown', () => {
  suppressAddHereRow = true;
}, { capture: true });

/**
 * Met à jour le panneau latéral selon la sélection courante.
 * Appelé par selectRow(), clearSelection(), et après render().
 * Ne fait jamais render() lui-même.
 */
function updateSidePanel() {
  const panel    = document.getElementById('side-panel');
  const infoEl   = document.getElementById('sp-info');
  const countEl  = document.getElementById('sp-count');
  const actionsEl= document.getElementById('sp-actions');
  if (!panel) return;

  const n  = selIds.size;
  const r  = n === 1 ? rows.find(x => x.id === selId) : null;

  if (!n) {
    // Nothing selected
    infoEl.textContent  = 'Aucune sélection';
    infoEl.className    = 'sp-info sp-empty';
    countEl.textContent = '';
    panel.dataset.state = 'empty';

    // Disable all action buttons
    panel.querySelectorAll('button[data-action]').forEach(b => b.disabled = true);
    return;
  }

  panel.dataset.state = n > 1 ? 'multi' : 'single';

  // Info label
  if (n === 1 && r) {
    const typeLabel = { chap:'Chapitre', sub:'Sous-chap.', art:'Article', subart:'Sous-article', blank:'Ligne vide' };
    infoEl.textContent = (typeLabel[r.type] || r.type) + (r.desig ? ' — ' + r.desig.substring(0,28) + (r.desig.length>28?'…':'') : '');
    infoEl.className   = 'sp-info sp-' + r.type;
  } else {
    infoEl.textContent = n + ' lignes sélectionnées';
    infoEl.className   = 'sp-info sp-multi';
  }
  countEl.textContent = n > 1 ? n + ' sél.' : '';

  // Enable/disable buttons based on context
  panel.querySelectorAll('button[data-action]').forEach(b => {
    b.disabled = false;
    const action = b.dataset.action;
    // "add subart" only makes sense after an article
    if (action === 'add-subart' && r && r.type !== 'art' && r.type !== 'subart') {
      b.disabled = (n === 1); // disable only for single selection on non-art
    }
  });

  // Wire drag handle for multi-row drag
  const dh = document.getElementById('sp-drag');
  if (dh) {
    dh.draggable = true;
    dh.ondragstart = (ev) => {
      ev.dataTransfer.effectAllowed = 'move';
      dragIds = selIds.has(selId) && selIds.size > 1 ? [...selIds] : [selId];
      dragIds = rows.filter(r => dragIds.includes(r.id)).map(r => r.id);
      setTimeout(() => {
        dragIds.forEach(did => {
          const t = document.getElementById('ro-' + did);
          if (t) t.classList.add('dragging');
        });
      }, 0);
    };
  }
}
