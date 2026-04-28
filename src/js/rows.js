/**
 * rows.js — Ajout, suppression, duplication, mise à jour des lignes.
 * render() is called only when data structure changes.
 * updateSidePanel() replaces all positionFloatCtrl() calls.
 */

function insertIdx(afterId) {
  const anchorId = afterId === undefined ? selId : afterId;
  if (anchorId === null) return rows.length;
  const idx = rows.findIndex(r => r.id === anchorId);
  return idx < 0 ? rows.length : idx + 1;
}

function lastUniteBefore(idx) {
  for (let i = idx - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.type === 'art' || r.type === 'subart') return r.unite;
  }
  return 'M²';
}

/* ── Add ── */
function addRow(type, level, afterId) {
  snapshot();
  const id  = uid();
  const idx = insertIdx(afterId);
  let obj;
  if (type === 'chap')   obj = { type, id, desig: '', collapsed: false };
  if (type === 'sub')    obj = { type, id, desig: '', level: level || 1, collapsed: false };
  if (type === 'art')    obj = { type, id, desig: '', unite: lastUniteBefore(idx), qty: '', pu: '' };
  if (type === 'subart') obj = { type, id, desig: '', unite: lastUniteBefore(idx), qty: '', pu: '' };
  if (type === 'blank')  obj = { type, id, desig: '' };
  rows.splice(idx, 0, obj);
  selId = id; selIds.clear(); selIds.add(id);
  render(); // structural change → render needed
  setTimeout(() => {
    const tr = document.getElementById('ro-' + id);
    if (tr) {
      tr.classList.add('sel-row');
      const inp = tr.querySelector('input.di, textarea.di');
      if (inp) { inp.focus(); inp.select(); }
    }
    updateSidePanel();
  }, 35);
  triggerAutosave();
}


document.addEventListener('keydown', e => {
  if (e.key === '+' && !e.ctrlKey && !e.metaKey &&
      e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault(); addRow('art');
  }
});

/* ── Delete ── */
function delSelected() {
  if (!selId && !selIds.size) return;
  snapshot();
  const toDelete = selIds.size > 0 ? new Set(selIds) : new Set([selId]);
  const toDeleteExpanded = new Set();
  toDelete.forEach(id => {
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0) extractBlock(idx).forEach(r => toDeleteExpanded.add(r.id));
  });
  rows = rows.filter(r => !toDeleteExpanded.has(r.id));
  selId = null; selIds.clear();
  render(); // structural change
  updateSidePanel();
  triggerAutosave();
  notif('✕ ' + toDeleteExpanded.size + ' ligne' + (toDeleteExpanded.size > 1 ? 's' : '') + ' supprimée' + (toDeleteExpanded.size > 1 ? 's' : ''));
}

/* ── Duplicate ── */
function dupSelected() {
  if (!selId && !selIds.size) return;
  snapshot();
  const ids     = selIds.size > 0 ? [...selIds] : [selId];
  const ordered = rows.filter(r => ids.includes(r.id));
  if (!ordered.length) return;
  const lastIdx = Math.max(...ordered.map(r => rows.indexOf(r)));
  const newIds  = new Set();
  const clones  = [];
  ordered.forEach(r => {
    const idx = rows.findIndex(x => x.id === r.id);
    extractBlock(idx).forEach((br, bi) => {
      const clone = { ...br, id: uid() };
      if (bi === 0) newIds.add(clone.id);
      clones.push(clone);
    });
  });
  rows.splice(lastIdx + 1, 0, ...clones);
  selIds = newIds; selId = [...newIds][0];
  render(); // structural change
  setTimeout(() => {
    applySelectionClasses();
    updateSidePanel();
  }, 35);
  triggerAutosave();
  notif('✓ ' + clones.length + ' dupliqué' + (clones.length > 1 ? 's' : ''));
}

/* ── Move up / down ── */
function moveSelected(dir) {
  if (!selId) return;
  const idx = rows.findIndex(r => r.id === selId);
  if (idx < 0) return;
  const block = extractBlock(idx);
  const blockLen = block.length;

  if (dir === 'up') {
    if (idx === 0) return;
    snapshot();
    rows.splice(idx, blockLen);
    rows.splice(idx - 1, 0, ...block);
  } else {
    if (idx + blockLen >= rows.length) return;
    snapshot();
    rows.splice(idx, blockLen);
    rows.splice(idx + 1, 0, ...block);
  }

  render();
  triggerAutosave();
}

document.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowUp')   { e.preventDefault(); moveSelected('up');   }
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSelected('down'); }
});

/* ── Update field (no render, uses recalc) ── */
const UPD_DEBOUNCE = {};
function upd(id, field, val) {
  const r = rows.find(r => r.id === id);
  if (!r) return;
  r[field] = val;
  // Debounce recalc + autosave to avoid per-keystroke cost
  clearTimeout(UPD_DEBOUNCE[id]);
  UPD_DEBOUNCE[id] = setTimeout(() => {
    recalc();
    triggerAutosave();
  }, 150);
}

/* ── Collapse ── */
function toggleCollapse(id, e) {
  e && e.stopPropagation();
  const r = rows.find(r => r.id === id);
  if (r) { r.collapsed = !r.collapsed; render(); triggerAutosave(); }
}
function collapseAll(v) {
  rows.filter(r => r.type === 'chap' || r.type === 'sub').forEach(r => r.collapsed = v);
  render(); triggerAutosave();
}

/* ── Extract block ── */
function extractBlock(idx) {
  const r = rows[idx];
  if (r.type === 'chap') {
    const bl = [r];
    for (let i = idx+1; i < rows.length; i++) { if (rows[i].type === 'chap') break; bl.push(rows[i]); }
    return bl;
  }
  if (r.type === 'art') {
    const bl = [r];
    for (let i = idx+1; i < rows.length; i++) { const t = rows[i].type; if (t==='subart'||t==='blank') bl.push(rows[i]); else break; }
    return bl;
  }
  if (r.type === 'sub') {
    const lv = r.level || 1;
    const bl = [r];
    for (let i = idx+1; i < rows.length; i++) {
      const t = rows[i].type;
      if (t === 'chap') break;
      if (t === 'sub' && (rows[i].level||1) <= lv) break;
      bl.push(rows[i]);
    }
    return bl;
  }
  return [r];
}

function handleTvaChange() { recalc(); triggerAutosave(); }
