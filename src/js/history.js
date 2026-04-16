/**
 * history.js — Gestion Undo / Redo (50 états).
 * Utilise JSON.stringify/parse sur rows[] pour les snapshots.
 */

function snapshot() {
  history = history.slice(0, hIdx + 1);
  history.push(JSON.stringify(rows));
  hIdx++;
  if (history.length > MAX_HIST) { history.shift(); hIdx--; }
}

function undo() {
  if (hIdx > 0) {
    hIdx--;
    rows = JSON.parse(history[hIdx]);
    render();
    notif('↶ Annulé');
    triggerAutosave();
  }
}

function redo() {
  if (hIdx < history.length - 1) {
    hIdx++;
    rows = JSON.parse(history[hIdx]);
    render();
    notif('↷ Rétabli');
    triggerAutosave();
  }
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
  if (e.ctrlKey && e.key === 'p') { e.preventDefault(); if(typeof doPreview==='function') doPreview(); }
});
