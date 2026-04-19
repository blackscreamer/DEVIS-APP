/**
 * ui.js — Helpers d'interface: save indicator, column widths (per-mode),
 * workspace size (A4 layout), resize.
 */

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

/* ── Column widths — per mode ── */

/**
 * Sync column panel inputs FROM the current mode's colWidths.
 * Called when the panel opens or mode changes.
 */
function syncColWidthUI() {
  const cw = colWidths[mode] || colWidths.DQE;
  const g  = id => document.getElementById(id);
  const isDQE = mode === 'DQE';

  // Autofit = all null
  const allNull = Object.values(cw).every(v => v === null);
  const autoEl  = g('col-autofit');
  if (autoEl) autoEl.checked = allNull;
  if (g('col-manual'))    g('col-manual').style.display    = allNull ? 'none' : 'block';
  if (g('col-auto-hint')) g('col-auto-hint').style.display = allNull ? 'block' : 'none';

  // DQE cols
  if (g('cw-num'))   g('cw-num').value   = cw.num   ?? 68;
  if (g('cw-desig')) g('cw-desig').value = cw.desig ?? 300;
  if (isDQE) {
    if (g('cw-unit')) g('cw-unit').value = cw.unit ?? 48;
    if (g('cw-qty'))  g('cw-qty').value  = cw.qty  ?? 80;
  }
  if (g('cw-pu'))    g('cw-pu').value    = cw.pu   ?? (isDQE ? 100 : 130);
  if (isDQE && g('cw-tot')) g('cw-tot').value = cw.tot ?? 110;

  // Show/hide DQE-only rows
  document.querySelectorAll('.dqe-col').forEach(el =>
    el.style.display = isDQE ? 'flex' : 'none'
  );
}

function toggleAutofit(enabled) {
  const cw = colWidths[mode];
  if (enabled) {
    // Set all to null = autofit
    Object.keys(cw).forEach(k => cw[k] = null);
  } else {
    // Restore sensible defaults for this mode
    if (mode === 'DQE') Object.assign(cw, { num: 68, desig: null, unit: 48, qty: 80, pu: 100, tot: 110 });
    else                Object.assign(cw, { num: 68, desig: null, pu: 130 });
  }
  if (document.getElementById('col-manual'))
    document.getElementById('col-manual').style.display    = enabled ? 'none'  : 'block';
  if (document.getElementById('col-auto-hint'))
    document.getElementById('col-auto-hint').style.display = enabled ? 'block' : 'none';
  applyColWidths();
}

function applyColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;
  const cw  = colWidths[mode];
  const g   = id => document.getElementById(id);

  // Read current input values into colWidths[mode]
  const autoEl = g('col-autofit');
  const isAuto = autoEl ? autoEl.checked : false;

  if (isAuto) {
    Object.keys(cw).forEach(k => cw[k] = null);
    tbl.style.tableLayout = 'auto';
    tbl.querySelectorAll('col').forEach(c => c.style.width = '');
    return;
  }

  // Read values from inputs
  if (g('cw-num'))   cw.num   = parseInt(g('cw-num').value)   || null;
  if (g('cw-desig')) cw.desig = parseInt(g('cw-desig').value) || null;
  if (mode === 'DQE') {
    if (g('cw-unit')) cw.unit = parseInt(g('cw-unit').value) || null;
    if (g('cw-qty'))  cw.qty  = parseInt(g('cw-qty').value)  || null;
  }
  if (g('cw-pu'))   cw.pu  = parseInt(g('cw-pu').value)  || null;
  if (mode === 'DQE' && g('cw-tot')) cw.tot = parseInt(g('cw-tot').value) || null;

  // Apply to colgroup elements
  tbl.style.tableLayout = 'fixed';
  const setCW = (sel, px) => {
    const col = tbl.querySelector(sel);
    if (col) col.style.width = px ? px + 'px' : '';
  };

  if (mode === 'BPU') {
    setCW('col.cn',      cw.num);
    setCW('col.cd',      cw.desig);
    setCW('col.cp-bpu',  cw.pu);
  } else {
    setCW('col.cn', cw.num);
    setCW('col.cd', cw.desig);
    setCW('col.cu', cw.unit);
    setCW('col.cq', cw.qty);
    setCW('col.cp', cw.pu);
    setCW('col.ct', cw.tot);
  }
}

/** Apply column widths silently (no UI read — uses stored colWidths[mode]) */
function applyStoredColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;
  const cw  = colWidths[mode];
  const allNull = Object.values(cw).every(v => v === null);

  if (allNull) {
    tbl.style.tableLayout = 'auto';
    tbl.querySelectorAll('col').forEach(c => c.style.width = '');
    return;
  }

  tbl.style.tableLayout = 'fixed';
  const setCW = (sel, px) => {
    const col = tbl.querySelector(sel);
    if (col) col.style.width = px ? px + 'px' : '';
  };

  if (mode === 'BPU') {
    setCW('col.cn',     cw.num);
    setCW('col.cd',     cw.desig);
    setCW('col.cp-bpu', cw.pu);
  } else {
    setCW('col.cn', cw.num);
    setCW('col.cd', cw.desig);
    setCW('col.cu', cw.unit);
    setCW('col.cq', cw.qty);
    setCW('col.cp', cw.pu);
    setCW('col.ct', cw.tot);
  }
}

window.addEventListener('resize', () => {
  document.querySelectorAll('textarea.di').forEach(t => ar(t));
  if (selId) {
    const tr = document.getElementById('ro-' + selId);
    if (tr) positionFloatCtrl(tr);
  }
});
