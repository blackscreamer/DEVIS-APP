/**
 * dragdrop.js — Drag & drop des lignes du tableau.
 * La poignée ⠿ dans le panneau flottant initie le drag.
 * Le drop peut cibler n'importe quelle ligne.
 */

function dov2(e, tr) {
  e.preventDefault();
  document.querySelectorAll('.dov-top,.dov-bot').forEach(el => el.classList.remove('dov-top','dov-bot'));
  const rect = tr.getBoundingClientRect();
  tr.classList.add(e.clientY < rect.top + rect.height / 2 ? 'dov-top' : 'dov-bot');
}

function dlv2(tr) { tr.classList.remove('dov-top','dov-bot'); }

function dp2(e, tr) {
  e.preventDefault();
  document.querySelectorAll('.dov-top,.dov-bot').forEach(el => el.classList.remove('dov-top','dov-bot'));
  const toId = tr.id.replace('ro-', '');
  if (!dragIds.length || dragIds.includes(toId)) { dragIds = []; return; }

  dragIds.forEach(did => { const t = document.getElementById('ro-' + did); if (t) t.classList.remove('dragging'); });

  snapshot();

  const rect  = tr.getBoundingClientRect();
  const before= e.clientY < rect.top + rect.height / 2;

  // Extraire et retirer tous les blocs dragués
  const allBlocks = [];
  dragIds.forEach(did => {
    const fi = rows.findIndex(r => r.id === did);
    if (fi < 0) return;
    allBlocks.push(...extractBlock(fi));
  });
  const blockIds = new Set(allBlocks.map(r => r.id));
  rows = rows.filter(r => !blockIds.has(r.id));

  // Recalculer la position cible
  let ni = rows.findIndex(r => r.id === toId);
  if (!before) ni++;
  if (ni < 0) ni = rows.length;
  rows.splice(ni, 0, ...allBlocks);

  dragIds = [];
  render();
  triggerAutosave();
}

/* Stubs pour les handlers inline (certains tr ont encore des attributs ondrag*) */
function dov(e) { e.preventDefault(); }
function dlv()  {}
function dp(e)  { e.preventDefault(); }

/* ── Delegated drag/drop on rows (replaces per-row listeners in render) ── */
(function () {
  const tbody = document.getElementById('body');
  tbody.addEventListener('dragover', e => {
    const tr = e.target.closest('tr[id^="ro-"]');
    if (tr) dov2(e, tr);
  });
  tbody.addEventListener('dragleave', e => {
    const tr = e.target.closest('tr[id^="ro-"]');
    if (tr && !tr.contains(e.relatedTarget)) dlv2(tr);
  });
  tbody.addEventListener('drop', e => {
    const tr = e.target.closest('tr[id^="ro-"]');
    if (tr) dp2(e, tr);
  });
}());
