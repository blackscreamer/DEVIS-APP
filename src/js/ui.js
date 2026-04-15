/**
 * ui.js — Helpers d'interface: save indicator, column widths, resize.
 */

let colAutofit = true; // true = browser auto, false = manual

/** Met à jour l'indicateur autosave */
function setSaveIndicator(state) {
  const ind = document.getElementById('save-ind');
  if (!ind) return;
  ind.className = state;
  if (state === 'saved')    ind.innerHTML = '<i class="bi bi-cloud-check"></i> Sauvegardé';
  else if (state === 'error') ind.innerHTML = '<i class="bi bi-exclamation-circle"></i> Erreur';
  else                      ind.innerHTML = '<i class="bi bi-cloud-check"></i> Auto';
}

/* ── Column widths ── */

function toggleAutofit(enabled) {
  colAutofit = enabled;
  document.getElementById('col-manual').style.display   = enabled ? 'none' : 'block';
  document.getElementById('col-auto-hint').style.display= enabled ? 'block': 'none';
  // Show/hide DQE-only rows
  document.querySelectorAll('.dqe-col').forEach(el => el.style.display = mode==='BPU'?'none':'flex');
  applyColWidths();
}

function applyColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;

  if (colAutofit) {
    // Remove all explicit widths — let browser auto-size
    tbl.style.tableLayout = 'auto';
    tbl.querySelectorAll('col').forEach(c => c.style.width = '');
    return;
  }

  // Manual mode
  tbl.style.tableLayout = 'fixed';
  const setCW = (sel, id) => {
    const el = document.getElementById(id);
    const col = tbl.querySelector(sel);
    if (el && col) col.style.width = el.value + 'px';
  };

  if (mode === 'BPU') {
    setCW('col.cn',     'cw-num');
    setCW('col.cd',     'cw-desig');
    setCW('col.cp-bpu', 'cw-pu');
  } else {
    setCW('col.cn', 'cw-num');
    setCW('col.cd', 'cw-desig');
    setCW('col.cu', 'cw-unit');
    setCW('col.cq', 'cw-qty');
    setCW('col.cp', 'cw-pu');
    setCW('col.ct', 'cw-tot');
  }
}

/* Keep DQE-only col rows hidden in BPU mode when panel is open */
document.addEventListener('DOMContentLoaded', () => {
  const colpop = document.getElementById('colpop');
  if (colpop) {
    colpop.addEventListener('show.bs.offcanvas', () => {
      document.querySelectorAll('.dqe-col').forEach(el =>
        el.style.display = mode === 'BPU' ? 'none' : 'flex'
      );
    });
  }
});

/** Adapte les textareas et le panneau flottant après resize fenêtre */
window.addEventListener('resize', () => {
  document.querySelectorAll('textarea.di').forEach(t => ar(t));
  if (selId) {
    const tr = document.getElementById('ro-' + selId);
    if (tr) positionFloatCtrl(tr);
  }
});
