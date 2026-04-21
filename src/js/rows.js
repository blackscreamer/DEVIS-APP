/**
 * rows.js — Ajout, suppression, duplication, mise à jour des lignes.
 */

/* ── Indice d'insertion (après la ligne sélectionnée) ── */
function insertIdx(afterId) {
  const anchorId = afterId === undefined ? selId : afterId;
  if (anchorId === null) return rows.length;
  const idx = rows.findIndex(r => r.id === anchorId);
  return idx < 0 ? rows.length : idx + 1;
}

/* ── Hérite de l'unité de la ligne précédente ── */
function lastUniteBefore(idx) {
  for (let i = idx - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.type === 'art' || r.type === 'subart') return r.unite;
  }
  return 'M²';
}

/* ── Ajouter une ligne ── */
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
  render();
  setTimeout(() => {
    const tr = document.getElementById('ro-' + id);
    if (tr) { tr.classList.add('sel-row'); positionFloatCtrl(tr); const inp = tr.querySelector('input.di,textarea.di'); if (inp) { inp.focus(); inp.select(); } }
  }, 35);
  triggerAutosave();
}

function addRowHere(type, level) {
  if (!selId) return addRow(type, level);
  addRow(type, level, selId);
}

/* Raccourci clavier + → ajouter article */
document.addEventListener('keydown', e => {
  if (e.key === '+' && !e.ctrlKey && !e.metaKey &&
      e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault(); addRow('art');
  }
});

/* ── Supprimer sélection ── */
function delSelected() {
  if (!selId && !selIds.size) return;
  snapshot();
  const toDelete = selIds.size > 0 ? new Set(selIds) : new Set([selId]);
  // Pour chaque id sélectionné, supprimer son bloc (art + ses subarts)
  const toDeleteExpanded = new Set();
  toDelete.forEach(id => {
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0) extractBlock(idx).forEach(r => toDeleteExpanded.add(r.id));
  });
  rows = rows.filter(r => !toDeleteExpanded.has(r.id));
  selId = null; selIds.clear();
  document.getElementById('float-ctrl').classList.add('hidden');
  render(); triggerAutosave();
  notif('✕ ' + toDeleteExpanded.size + ' ligne' + (toDeleteExpanded.size > 1 ? 's' : '') + ' supprimée' + (toDeleteExpanded.size > 1 ? 's' : ''));
}

/* ── Dupliquer sélection ── */
function dupSelected() {
  if (!selId && !selIds.size) return;
  snapshot();
  const ids     = selIds.size > 0 ? [...selIds] : [selId];
  const ordered = rows.filter(r => ids.includes(r.id));
  if (!ordered.length) return;
  const lastIdx = Math.max(...ordered.map(r => rows.indexOf(r)));
  const newIds  = new Set();
  // Clone chaque ligne avec son bloc
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
  render();
  setTimeout(() => {
    const tr = document.getElementById('ro-' + selId);
    if (tr) { tr.classList.add('sel-row'); positionFloatCtrl(tr); }
  }, 35);
  triggerAutosave();
  notif('✓ ' + clones.length + ' dupliqué' + (clones.length > 1 ? 's' : ''));
}

/* ── Mettre à jour un champ ── */
function upd(id, field, val) {
  const r = rows.find(r => r.id === id);
  if (r) { r[field] = val; recalc(); triggerAutosave(); }
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

/* ── Extrait le bloc d'une ligne (pour drag, dup, del) ── */
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

/* ── TVA change ── */
function handleTvaChange() { recalc(); triggerAutosave(); }
