/**
 * ui.js — Save indicator, dynamic header lines, column widths (per-mode),
 *          workspace size (A4 proportions), resize handling.
 */

/* ── Save indicator ── */
function setSaveIndicator(state) {
  const ind = document.getElementById('save-ind');
  if (!ind) return;
  ind.className = state;
  if (state === 'saved')      ind.innerHTML = '<i class="bi bi-cloud-check"></i> Sauvegardé';
  else if (state === 'error') ind.innerHTML = '<i class="bi bi-exclamation-circle"></i> Erreur';
  else                        ind.innerHTML = '<i class="bi bi-cloud-check"></i> Auto';
}

/* ════════════════════════════════════════════
   DYNAMIC HEADER LINES
   headerLines[] lives in state.js.
   Each entry: { text: string, style: 't1'|'t2' }
   't1' = large bold underlined (main title)
   't2' = smaller bold uppercase (subtitle)
   Double-click an input to toggle style.
════════════════════════════════════════════ */
function renderHeaderLines() {
  const container = document.getElementById('hdr-lines');
  if (!container) return;
  container.innerHTML = '';

  headerLines.forEach((line, i) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;position:relative;margin-bottom:1px;';

    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.value       = line.text;
    inp.className   = 'hdr-line ' + line.style;
    inp.placeholder = i === 0 ? 'TITRE DU PROJET…' : 'Sous-titre ligne ' + (i + 1) + '…';
    inp.title       = 'Double-clic pour basculer grand titre / sous-titre';

    inp.addEventListener('input',   () => { headerLines[i].text = inp.value; triggerAutosave(); });
    inp.addEventListener('dblclick',() => {
      headerLines[i].style = line.style === 't1' ? 't2' : 't1';
      triggerAutosave();
      renderHeaderLines();
    });

    wrap.appendChild(inp);

    // Delete button (only if more than 1 line)
    if (headerLines.length > 1) {
      const btn = document.createElement('button');
      btn.textContent = '✕';
      btn.title       = 'Supprimer cette ligne';
      btn.style.cssText = 'position:absolute;right:-24px;top:50%;transform:translateY(-50%);'
        + 'background:none;border:none;color:#ccc;font-size:11px;cursor:pointer;padding:2px 4px;line-height:1;';
      btn.addEventListener('mouseenter', () => btn.style.color = '#c00');
      btn.addEventListener('mouseleave', () => btn.style.color = '#ccc');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        headerLines.splice(i, 1);
        triggerAutosave();
        renderHeaderLines();
      });
      wrap.appendChild(btn);
    }

    container.appendChild(wrap);
  });
}

function addHeaderLine() {
  headerLines.push({ text: '', style: 't2' });
  triggerAutosave();
  renderHeaderLines();
  setTimeout(() => {
    const inputs = document.querySelectorAll('#hdr-lines input');
    if (inputs.length) { inputs[inputs.length - 1].focus(); }
  }, 40);
}

/* ════════════════════════════════════════════
   WORKSPACE SIZE
   Makes #doc match the real paper dimensions
   and margins from pageLayout.

   Paper sizes at 96 DPI (1 mm = 3.7795 px):
     A4     210 × 297 mm  →  794 × 1123 px
     A3     297 × 420 mm  → 1123 × 1587 px
     Letter 215.9 × 279.4 mm → 816 × 1056 px
     Legal  215.9 × 355.6 mm → 816 × 1344 px
════════════════════════════════════════════ */
const MM_TO_PX = 3.7795;

const PAPER_SIZES = {
  A4:     { w: 210,   h: 297   },
  A3:     { w: 297,   h: 420   },
  Letter: { w: 215.9, h: 279.4 },
  Legal:  { w: 215.9, h: 355.6 },
};

function updateWorkspaceSize() {
  const doc = document.getElementById('doc');
  if (!doc) return;

  const p    = pageLayout;
  const size = PAPER_SIZES[p.size] || PAPER_SIZES.A4;
  const land = p.orient === 'landscape';

  const paperW = land ? size.h : size.w;
  const paperH = land ? size.w : size.h;

  const pxW = Math.round(paperW * MM_TO_PX);
  const pxH = Math.round(paperH * MM_TO_PX);

  const mt = Math.round((p.mt ?? 15) * MM_TO_PX);
  const mb = Math.round((p.mb ?? 15) * MM_TO_PX);
  const ml = Math.round((p.ml ?? 15) * MM_TO_PX);
  const mr = Math.round((p.mr ?? 15) * MM_TO_PX);

  doc.style.width     = pxW + 'px';
  doc.style.minHeight = pxH + 'px';
  doc.style.padding   = `${mt}px ${mr}px ${mb}px ${ml}px`;
}

/* ════════════════════════════════════════════
   COLUMN WIDTHS — per mode (DQE / BPU)
   colWidths lives in state.js.
   null = autofit for that column.
════════════════════════════════════════════ */

/** Sync column panel UI FROM stored colWidths[mode] */
function syncColWidthUI() {
  const cw     = colWidths[mode] || colWidths.DQE;
  const g      = id => document.getElementById(id);
  const isDQE  = mode === 'DQE';

  const allNull = Object.values(cw).every(v => v === null);
  const autoEl  = g('col-autofit');
  if (autoEl) autoEl.checked = allNull;

  if (g('col-manual'))    g('col-manual').style.display    = allNull ? 'none'  : 'block';
  if (g('col-auto-hint')) g('col-auto-hint').style.display = allNull ? 'block' : 'none';

  if (g('cw-num'))   g('cw-num').value   = cw.num   ?? 68;
  if (g('cw-desig')) g('cw-desig').value = cw.desig ?? 300;
  if (isDQE) {
    if (g('cw-unit')) g('cw-unit').value = cw.unit ?? 48;
    if (g('cw-qty'))  g('cw-qty').value  = cw.qty  ?? 80;
  }
  if (g('cw-pu'))   g('cw-pu').value   = cw.pu  ?? (isDQE ? 100 : 130);
  if (isDQE && g('cw-tot')) g('cw-tot').value = cw.tot ?? 110;

  document.querySelectorAll('.dqe-col').forEach(el =>
    el.style.display = isDQE ? 'flex' : 'none'
  );
}

/**
 * toggleAutofit — called by the autofit checkbox.
 * Sets all colWidths[mode] values to null (autofit) or defaults.
 */
function toggleAutofit(enabled) {
  const cw = colWidths[mode];
  if (enabled) {
    Object.keys(cw).forEach(k => cw[k] = null);
  } else {
    if (mode === 'DQE') Object.assign(cw, { num: 68, desig: null, unit: 48, qty: 80, pu: 100, tot: 110 });
    else                Object.assign(cw, { num: 68, desig: null, pu: 130 });
  }
  const g = id => document.getElementById(id);
  if (g('col-manual'))    g('col-manual').style.display    = enabled ? 'none'  : 'block';
  if (g('col-auto-hint')) g('col-auto-hint').style.display = enabled ? 'block' : 'none';
  applyStoredColWidths();
}

/**
 * applyColWidths — reads input values, saves to colWidths[mode], applies to DOM.
 * Called when user changes a value in the column panel.
 */
function applyColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;
  const cw = colWidths[mode];
  const g  = id => document.getElementById(id);

  const autoEl = g('col-autofit');
  if (autoEl && autoEl.checked) {
    Object.keys(cw).forEach(k => cw[k] = null);
    tbl.style.tableLayout = 'auto';
    tbl.querySelectorAll('col').forEach(c => c.style.width = '');
    return;
  }

  const readPx = id => { const el = g(id); return el ? (parseInt(el.value) || null) : null; };
  cw.num   = readPx('cw-num');
  cw.desig = readPx('cw-desig');
  if (mode === 'DQE') { cw.unit = readPx('cw-unit'); cw.qty = readPx('cw-qty'); }
  cw.pu    = readPx('cw-pu');
  if (mode === 'DQE') cw.tot = readPx('cw-tot');

  applyStoredColWidths();
}

/**
 * applyStoredColWidths — reads colWidths[mode] and applies to DOM.
 * Never reads from inputs. Safe to call any time (setMode, init, load).
 */
function applyStoredColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;
  const cw = colWidths[mode] || (mode === 'DQE' ? colWidths.DQE : colWidths.BPU);

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

/* ── Window resize handler ── */
window.addEventListener('resize', () => {
  document.querySelectorAll('textarea.di').forEach(t => ar(t));
  if (selId) {
    const tr = document.getElementById('ro-' + selId);
    if (tr) positionFloatCtrl(tr);
  }
});
