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

  // Self-heal: ensure headerLines is always a valid array
  if (!Array.isArray(headerLines) || headerLines.length === 0) {
    headerLines = [{ text: '', style: 't1' }, { text: '', style: 't2' }];
  }

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
  // Guard: ensure headerLines is a valid array
  if (!Array.isArray(headerLines) || headerLines.length === 0) {
    headerLines = [{ text: '', style: 't1' }, { text: '', style: 't2' }];
  }
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

/* ════════════════════════════════════════════
   COLUMN WIDTHS — manual per mode (DQE / BPU)
   
   Logic:
   - Widths are ALWAYS manual px values stored in colWidths[mode]
   - applyColWidths()       reads inputs → saves to state → applies to DOM
   - applyStoredColWidths() reads state → applies to DOM (no input read)
   - autoFitColWidths()     measures DOM content → saves as manual → applies
   - No toggle: autofit is a one-shot action, not a mode
════════════════════════════════════════════ */

/** Sync column panel inputs FROM stored colWidths[mode] */
function syncColWidthUI() {
  const cw    = colWidths[mode];
  const isDQE = mode === 'DQE';
  const g     = id => document.getElementById(id);

  // Update mode label in panel
  const lbl = g('col-mode-label');
  if (lbl) { lbl.textContent = mode; lbl.style.color = isDQE ? '#1a56a0' : '#c06000'; }

  if (g('cw-num'))   g('cw-num').value   = cw.num   || 55;
  if (isDQE) {
    if (g('cw-unit')) g('cw-unit').value = cw.unit || 38;
    if (g('cw-qty'))  g('cw-qty').value  = cw.qty  || 88;
  }
  if (g('cw-pu'))  g('cw-pu').value  = cw.pu  || (isDQE ? 90 : 120);
  if (isDQE && g('cw-tot')) g('cw-tot').value = cw.tot || 108;

  document.querySelectorAll('.dqe-col').forEach(el =>
    el.style.display = isDQE ? 'flex' : 'none'
  );
}

/**
 * applyColWidths — reads inputs, saves to colWidths[mode], applies to DOM.
 * Called on every input change in the column panel.
 */
function applyColWidths() {
  const cw    = colWidths[mode];
  const isDQE = mode === 'DQE';
  const g     = id => document.getElementById(id);
  const readPx = id => { const el = g(id); return el ? (parseInt(el.value) || 0) : 0; };

  cw.num   = readPx('cw-num')   || 55;
  cw.desig = readPx('cw-desig') || 0;
  if (isDQE) { cw.unit = readPx('cw-unit') || 38; cw.qty = readPx('cw-qty') || 88; }
  cw.pu    = readPx('cw-pu')    || (isDQE ? 90 : 120);
  if (isDQE) cw.tot = readPx('cw-tot') || 108;

  applyStoredColWidths();
  triggerAutosave();
}

/**
 * applyStoredColWidths — applies colWidths[mode] to the live table.
 * Never reads from inputs. Safe to call any time.
 * Called by setMode(), init, and after loading a file.
 */
function applyStoredColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;
  const cw = colWidths[mode];

  // Use table-layout:fixed so explicit widths are respected
  tbl.style.tableLayout = 'fixed';

  const setCW = (sel, px) => {
    const col = tbl.querySelector(sel);
    if (!col) return;
    if (px > 0) col.style.width = px + 'px';
    else        col.style.width = '';   // desig=0 → takes remaining space
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

/**
 * autoFitColWidths — ONE-SHOT action.
 * Measures the actual rendered content widths in the live table,
 * saves them as the manual colWidths[mode] values, and applies.
 * Does NOT create a toggle mode — just updates the manual settings.
 */
function autoFitColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;

  // Temporarily switch to auto layout so browser calculates natural widths
  tbl.style.tableLayout = 'auto';
  tbl.querySelectorAll('col').forEach(c => c.style.width = '');

  // Read the computed widths after browser layout
  requestAnimationFrame(() => {
    const cols = tbl.querySelectorAll('col');
    const cw   = colWidths[mode];
    const isDQE = mode === 'DQE';

    // Get measured widths from the rendered <col> elements
    // We measure via the first <td> in each column position
    const rows2 = tbl.querySelectorAll('tbody tr:not([style*="display:none"])');
    let colMeasured = [];

    if (rows2.length > 0) {
      // Find a row with maximum cells (art row = all columns)
      let maxRow = null;
      rows2.forEach(tr => { if (!maxRow || tr.cells.length > maxRow.cells.length) maxRow = tr; });
      if (maxRow) {
        Array.from(maxRow.cells).forEach(td => {
          colMeasured.push(td.getBoundingClientRect().width);
        });
      }
    }

    // Fallback to header cells if no data row found
    if (!colMeasured.length) {
      const hrow = tbl.querySelector('thead tr');
      if (hrow) Array.from(hrow.cells).forEach(th => colMeasured.push(th.getBoundingClientRect().width));
    }

    // Save measured widths — round up, add 2px buffer
    const px = i => Math.ceil((colMeasured[i] || 0)) + 2;

    if (isDQE && colMeasured.length >= 6) {
      cw.num   = Math.max(px(0), 40);
      cw.desig = 0; // always let desig take remaining space
      cw.unit  = Math.max(px(2), 30);
      cw.qty   = Math.max(px(3), 50);
      cw.pu    = Math.max(px(4), 60);
      cw.tot   = Math.max(px(5), 70);
    } else if (!isDQE && colMeasured.length >= 3) {
      cw.num   = Math.max(px(0), 40);
      cw.desig = 0;
      cw.pu    = Math.max(px(2), 70);
    }

    // Apply and sync UI
    applyStoredColWidths();
    syncColWidthUI();
    triggerAutosave();
    notif('✓ Largeurs ajustées et sauvegardées');
  });
}

/* ── Window resize handler ── */
window.addEventListener('resize', () => {
  document.querySelectorAll('textarea.di').forEach(t => ar(t));
  if (selId) {
    const tr = document.getElementById('ro-' + selId);
    if (tr) positionFloatCtrl(tr);
  }
});
