/**
 * selection.js — Gestion de la sélection (simple, Ctrl, Shift).
 *
 * PERF: selectRow ne fait JAMAIS render().
 * Elle manipule uniquement les classes CSS sur les <tr> existants
 * et met à jour le panneau latéral fixe.
 */

function selectRow(id, trEl, e) {
  if (e && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')) return;
  if (e) e.stopPropagation();

  if (e && (e.ctrlKey || e.metaKey)) {
    /* ── Multi-sélection Ctrl/Cmd ── */
    if (selIds.has(id)) selIds.delete(id);
    else                selIds.add(id);
    selId = id;
  } else if (e && e.shiftKey && selId) {
    /* ── Sélection plage Shift ── */
    const fromIdx = rows.findIndex(r => r.id === selId);
    const toIdx   = rows.findIndex(r => r.id === id);
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    for (let i = lo; i <= hi; i++) selIds.add(rows[i].id);
    // selId stays as anchor
  } else {
    /* ── Sélection simple ── */
    selIds.clear();
    selIds.add(id);
    selId = id;
  }

  // CSS only — no render()
  applySelectionClasses();
  updateSidePanel();
}

/** Applique les classes sel-row / sel-multi sur les <tr> existants */
function applySelectionClasses() {
  // Clear all
  document.querySelectorAll('tr.sel-row, tr.sel-multi')
    .forEach(t => t.classList.remove('sel-row', 'sel-multi'));

  if (!selIds.size) return;

  selIds.forEach(sid => {
    const tr = document.getElementById('ro-' + sid);
    if (!tr) return;
    tr.classList.add(selIds.size === 1 ? 'sel-row' : 'sel-multi');
  });

  // Active row gets sel-row regardless of multi
  if (selId) {
    const activeTr = document.getElementById('ro-' + selId);
    if (activeTr) { activeTr.classList.remove('sel-multi'); activeTr.classList.add('sel-row'); }
  }
}

/** Soft select — used after add/dup, no re-render needed */
function selectRowSoft(id) {
  selIds.clear(); selIds.add(id); selId = id;
  applySelectionClasses();
  updateSidePanel();
}

function clearSelection() {
  selId = null; selIds.clear();
  document.querySelectorAll('tr.sel-row, tr.sel-multi')
    .forEach(t => t.classList.remove('sel-row', 'sel-multi'));
  updateSidePanel();
  // NO render() here
}

/* ── Click outside table → clear selection ── */
document.addEventListener('click', e => {
  if (!e.target.closest('#tbl')       &&
      !e.target.closest('#side-panel') &&
      !e.target.closest('#appbar')     &&
      !e.target.closest('.offcanvas'))
    clearSelection();
}, { passive: true });
