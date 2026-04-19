/**
 * ui.js — Helpers d'interface: save indicator, column widths, workspace size, resize.
 */

let colAutofit = true;

function setSaveIndicator(state) {
  const ind = document.getElementById('save-ind');
  if (!ind) return;
  ind.className = state;
  if (state === 'saved')      ind.innerHTML = '<i class="bi bi-cloud-check"></i> Sauvegardé';
  else if (state === 'error') ind.innerHTML = '<i class="bi bi-exclamation-circle"></i> Erreur';
  else                        ind.innerHTML = '<i class="bi bi-cloud-check"></i> Auto';
}

/* ════════════════════════════════════════════
   WORKSPACE SIZE — makes #doc match the real
   paper dimensions and margins set in pageLayout.
   
   Paper sizes at 96 DPI:
     A4:     794 × 1123 px  (210 × 297 mm)
     A3:     1123 × 1587 px (297 × 420 mm)
     Letter: 816 × 1056 px  (215.9 × 279.4 mm)
     Legal:  816 × 1344 px  (215.9 × 355.6 mm)
   
   1 mm = 3.7795 px at 96 DPI
════════════════════════════════════════════ */
const MM_TO_PX = 3.7795;

const PAPER_SIZES = {
  A4:     { w: 210, h: 297 },
  A3:     { w: 297, h: 420 },
  Letter: { w: 215.9, h: 279.4 },
  Legal:  { w: 215.9, h: 355.6 },
};

function updateWorkspaceSize() {
  const doc = document.getElementById('doc');
  if (!doc) return;

  const p    = pageLayout;
  const size = PAPER_SIZES[p.size] || PAPER_SIZES.A4;
  const landscape = p.orient === 'landscape';

  const paperW = landscape ? size.h : size.w;
  const paperH = landscape ? size.w : size.h;

  const pxW  = Math.round(paperW * MM_TO_PX);
  const pxH  = Math.round(paperH * MM_TO_PX);

  // Margins (mm → px)
  const mt = Math.round((p.mt ?? 15) * MM_TO_PX);
  const mb = Math.round((p.mb ?? 15) * MM_TO_PX);
  const ml = Math.round((p.ml ?? 15) * MM_TO_PX);
  const mr = Math.round((p.mr ?? 15) * MM_TO_PX);

  doc.style.width      = pxW + 'px';
  doc.style.minHeight  = pxH + 'px';
  doc.style.padding    = `${mt}px ${mr}px ${mb}px ${ml}px`;

  // Also update the table to fill available width
  const tbl = document.getElementById('tbl');
  if (tbl) tbl.style.width = '100%';
}

/* ── Column widths ── */
function toggleAutofit(enabled) {
  colAutofit = enabled;
  document.getElementById('col-manual').style.display    = enabled ? 'none'  : 'block';
  document.getElementById('col-auto-hint').style.display = enabled ? 'block' : 'none';
  document.querySelectorAll('.dqe-col').forEach(el =>
    el.style.display = mode === 'BPU' ? 'none' : 'flex'
  );
  applyColWidths();
}

function applyColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;

  if (colAutofit) {
    tbl.style.tableLayout = 'auto';
    tbl.querySelectorAll('col').forEach(c => c.style.width = '');
    return;
  }

  tbl.style.tableLayout = 'fixed';
  const setCW = (sel, inputId) => {
    const el  = document.getElementById(inputId);
    const col = tbl.querySelector(sel);
    if (el && col) col.style.width = el.value + 'px';
  };

  if (mode === 'BPU') {
    setCW('col.cn',      'cw-num');
    setCW('col.cd',      'cw-desig');
    setCW('col.cp-bpu',  'cw-pu');
  } else {
    setCW('col.cn', 'cw-num');
    setCW('col.cd', 'cw-desig');
    setCW('col.cu', 'cw-unit');
    setCW('col.cq', 'cw-qty');
    setCW('col.cp', 'cw-pu');
    setCW('col.ct', 'cw-tot');
  }
}

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

window.addEventListener('resize', () => {
  document.querySelectorAll('textarea.di').forEach(t => ar(t));
  if (selId) {
    const tr = document.getElementById('ro-' + selId);
    if (tr) positionFloatCtrl(tr);
  }
});
