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
   DYNAMIC HEADER LINES
════════════════════════════════════════════ */

function renderHeaderLines() {
  const container = document.getElementById('hdr-lines');
  if (!container) return;
  container.innerHTML = '';
  headerLines.forEach((line, i) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;position:relative;';
    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.value       = line.text;
    inp.className   = 'hdr-line ' + line.style;
    inp.placeholder = i === 0 ? 'TITRE DU PROJET…' : 'Sous-titre ligne '+(i+1)+'…';
    inp.oninput     = () => { headerLines[i].text = inp.value; triggerAutosave(); };
    // Toggle style on double-click
    inp.ondblclick  = () => {
      headerLines[i].style = line.style === 't1' ? 't2' : 't1';
      triggerAutosave(); renderHeaderLines();
    };
    inp.title = 'Double-clic pour changer le style (grand/normal)';
    wrap.appendChild(inp);
    // Delete button (keep at least 1 line)
    if (headerLines.length > 1) {
      const btn = document.createElement('button');
      btn.textContent = '✕';
      btn.title = 'Supprimer cette ligne';
      btn.style.cssText = 'position:absolute;right:-22px;background:none;border:none;color:#ccc;font-size:11px;cursor:pointer;padding:2px;';
      btn.onmouseenter = () => btn.style.color = '#c00';
      btn.onmouseleave = () => btn.style.color = '#ccc';
      btn.onclick = () => { headerLines.splice(i,1); triggerAutosave(); renderHeaderLines(); };
      wrap.appendChild(btn);
    }
    container.appendChild(wrap);
  });
}

function addHeaderLine() {
  headerLines.push({ text: '', style: 't2' });
  triggerAutosave();
  renderHeaderLines();
  // Focus the new input
  setTimeout(() => {
    const inputs = document.querySelectorAll('#hdr-lines input');
    if (inputs.length) inputs[inputs.length-1].focus();
  }, 30);
}
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

/**
 * applyColWidths() — called by the column panel UI.
 * Reads width values from the input fields, saves them
 * to colWidths[mode], then applies to the DOM.
 */
function applyColWidths() {
  const tbl = document.getElementById('tbl');
  if (!tbl) return;
  const cw = colWidths[mode];
  const g  = id => document.getElementById(id);

  const autoEl = g('col-autofit');
  const isAuto = autoEl ? autoEl.checked : false;

  if (isAuto) {
    // Set all values to null = autofit
    Object.keys(cw).forEach(k => cw[k] = null);
    tbl.style.tableLayout = 'auto';
    tbl.querySelectorAll('col').forEach(c => c.style.width = '');
    return;
  }

  // Read from inputs and SAVE into colWidths[mode]
  const readPx = id => { const el = g(id); return el ? (parseInt(el.value) || null) : null; };
  cw.num   = readPx('cw-num');
  cw.desig = readPx('cw-desig');
  if (mode === 'DQE') { cw.unit = readPx('cw-unit'); cw.qty = readPx('cw-qty'); }
  cw.pu  = readPx('cw-pu');
  if (mode === 'DQE') cw.tot = readPx('cw-tot');

  // Now apply the saved values
  applyStoredColWidths();
}

/**
 * applyStoredColWidths() — applies colWidths[mode] to the DOM.
 * Never reads from inputs. Safe to call at any time.
 * Called by: setMode(), init, loadFile.
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

window.addEventListener('resize', () => {
  document.querySelectorAll('textarea.di').forEach(t => ar(t));
  if (selId) {
    const tr = document.getElementById('ro-' + selId);
    if (tr) positionFloatCtrl(tr);
  }
});
