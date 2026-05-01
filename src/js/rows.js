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
async function delSelected() {
  if (!selId && !selIds.size) return;

  const toDelete = selIds.size > 0 ? new Set(selIds) : new Set([selId]);

  // Show the choice dialog only when:
  // - exactly ONE row is selected
  // - it is a chap or sub
  // - it has children (block size > 1)
  if (toDelete.size === 1) {
    const id  = [...toDelete][0];
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0) {
      const r     = rows[idx];
      const block = extractBlock(idx);
      if ((r.type === 'chap' || r.type === 'sub') && block.length > 1) {
        const choice = await showDelDialog(r);
        // choice: 'header' = only the heading row
        //         'all'    = the whole block
        //         null     = cancelled
        if (!choice) return;
        snapshot();
        if (choice === 'header') {
          // Remove only the heading row, keep children in place
          rows.splice(idx, 1);
        } else {
          // Remove entire block
          const blockIds = new Set(block.map(b => b.id));
          rows = rows.filter(r => !blockIds.has(r.id));
        }
        selId = null; selIds.clear();
        render();
        updateSidePanel();
        triggerAutosave();
        notif('✕ Supprimé');
        return;
      }
    }
  }

  // Default: delete all selected rows with their blocks (original behaviour)
  snapshot();
  const toDeleteExpanded = new Set();
  toDelete.forEach(id => {
    const idx = rows.findIndex(r => r.id === id);
    if (idx >= 0) extractBlock(idx).forEach(r => toDeleteExpanded.add(r.id));
  });
  rows = rows.filter(r => !toDeleteExpanded.has(r.id));
  selId = null; selIds.clear();
  render();
  updateSidePanel();
  triggerAutosave();
  notif('✕ ' + toDeleteExpanded.size + ' ligne' + (toDeleteExpanded.size > 1 ? 's' : '') + ' supprimée' + (toDeleteExpanded.size > 1 ? 's' : ''));
}

/**
 * Shows a small inline dialog inside the document asking whether to
 * delete only the heading row or the entire block.
 * Returns a Promise that resolves to 'header', 'all', or null (cancel).
 */
function showDelDialog(row) {
  return new Promise(resolve => {
    // Remove any existing dialog
    document.getElementById('del-dialog')?.remove();

    const typeLabel = row.type === 'chap' ? 'chapitre' : 'sous-chapitre';
    const name      = row.desig ? `« ${row.desig.substring(0, 40)}${row.desig.length > 40 ? '…' : ''} »` : `ce ${typeLabel}`;

    const d = document.createElement('div');
    d.id    = 'del-dialog';
    d.innerHTML = `
      <div class="del-dialog-backdrop"></div>
      <div class="del-dialog-box">
        <div class="del-dialog-title">
          <i class="bi bi-trash3 me-2"></i>Supprimer ${name}
        </div>
        <div class="del-dialog-body">
          Ce ${typeLabel} contient des lignes enfants. Comment voulez-vous procéder ?
        </div>
        <div class="del-dialog-actions">
          <button class="del-btn del-btn-header" id="ddb-header">
            <i class="bi bi-layout-text-sidebar me-1"></i>
            Supprimer l'en-tête uniquement
            <small>Le contenu reste dans le document</small>
          </button>
          <button class="del-btn del-btn-all" id="ddb-all">
            <i class="bi bi-trash3-fill me-1"></i>
            Supprimer avec tout le contenu
            <small>Articles et sous-chapitres inclus</small>
          </button>
          <button class="del-btn del-btn-cancel" id="ddb-cancel">
            <i class="bi bi-x me-1"></i>Annuler
          </button>
        </div>
      </div>`;
    document.body.appendChild(d);

    const cleanup = (result) => { d.remove(); resolve(result); };
    document.getElementById('ddb-header').onclick = () => cleanup('header');
    document.getElementById('ddb-all').onclick    = () => cleanup('all');
    document.getElementById('ddb-cancel').onclick = () => cleanup(null);
    document.querySelector('.del-dialog-backdrop').onclick = () => cleanup(null);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); cleanup(null); }
    });
  });
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
