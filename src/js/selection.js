/**
 * selection.js — Gestion de la sélection de lignes (simple, Ctrl, Shift)
 * et positionnement du panneau flottant.
 */

function selectRow(id, trEl, e) {
  if (e && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')) return;

  if (e && (e.ctrlKey || e.metaKey)) {
    if (selIds.has(id)) selIds.delete(id); else selIds.add(id);
    selId = id;
  } else if (e && e.shiftKey && selId) {
    const fromIdx = rows.findIndex(r => r.id === selId);
    const toIdx   = rows.findIndex(r => r.id === id);
    const lo = Math.min(fromIdx, toIdx), hi = Math.max(fromIdx, toIdx);
    for (let i = lo; i <= hi; i++) selIds.add(rows[i].id);
  } else {
    selIds.clear(); selIds.add(id); selId = id;
  }

  document.querySelectorAll('tr.sel-row,tr.sel-multi').forEach(t => t.classList.remove('sel-row','sel-multi'));
  selIds.forEach(sid => {
    const tr = document.getElementById('ro-' + sid);
    if (tr) tr.classList.add(selIds.size===1 ? 'sel-row' : 'sel-multi');
  });
  if (trEl) {
    if (selIds.size > 1) { trEl.classList.remove('sel-multi'); trEl.classList.add('sel-row'); }
    positionFloatCtrl(trEl);
  }
}

function positionFloatCtrl(trEl) {
  const fc = document.getElementById('float-ctrl');
  if (!trEl) { fc.classList.add('hidden'); return; }
  fc.classList.remove('hidden');
  const rect = trEl.getBoundingClientRect();
  const top  = rect.top + rect.height / 2 - 16;
  let left   = rect.right + 6;
  if (left + 210 > window.innerWidth) left = rect.right - 215;
  fc.style.top  = Math.max(44, top) + 'px';
  fc.style.left = Math.max(4, left) + 'px';

  const cnt = document.getElementById('fc-count');
  if (cnt) { cnt.style.display = selIds.size > 1 ? '' : 'none'; cnt.textContent = selIds.size > 1 ? selIds.size + ' sél.' : ''; }

  const dh = document.getElementById('fc-drag');
  dh.ondragstart = null;
  dh.draggable   = true;
  dh.ondragstart = (ev) => {
    ev.dataTransfer.effectAllowed = 'move';
    dragIds = selIds.has(selId) && selIds.size > 1 ? [...selIds] : [selId];
    dragIds = rows.filter(r => dragIds.includes(r.id)).map(r => r.id);
    setTimeout(() => {
      dragIds.forEach(did => { const t = document.getElementById('ro-' + did); if (t) t.classList.add('dragging'); });
    }, 0);
  };
}

function clearSelection() {
  selId = null; selIds.clear();
  document.querySelectorAll('tr.sel-row,tr.sel-multi').forEach(t => t.classList.remove('sel-row','sel-multi'));
  document.getElementById('float-ctrl').classList.add('hidden');
}

document.addEventListener('click', e => {
  if (!e.target.closest('#tbl') && !e.target.closest('#float-ctrl') &&
      !e.target.closest('#appbar') && !e.target.closest('#colorpop'))
    clearSelection();
}, { passive: true });
