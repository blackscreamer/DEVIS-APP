/**
 * files.js — Save, load, backup, print, PDF.
 *
 * Key function: buildPrintHTML()
 *   Captures the rendered document (table + TTC lines) as a self-contained
 *   HTML string with all CSS inlined. The page layout settings (margins,
 *   header, footer, paper size) are injected as a @page CSS rule.
 *   This HTML is sent to main.js which loads it in a hidden BrowserWindow
 *   and calls window.print() → shows the native OS print dialog with preview.
 */

const isElectron = !!(window.electronAPI);

/* ── Save data ── */
function getSaveData() {
  return {
    v: 8, rows, mode, nid, C, showPrices,
    tva:  document.getElementById('tva').value,
    l1:   document.getElementById('hl1').value,
    l2:   document.getElementById('hl2').value,
    l3:   document.getElementById('hl3').value,
    pageLayout,   // save page layout settings too
  };
}

function applyLoadedData(d) {
  rows = d.rows || [];
  nid  = d.nid  || 1;
  if (d.C) C = d.C;
  if (d.pageLayout) Object.assign(pageLayout, d.pageLayout);
  document.getElementById('tva').value = d.tva || 19;
  document.getElementById('hl1').value = d.l1  || '';
  document.getElementById('hl2').value = d.l2  || '';
  document.getElementById('hl3').value = d.l3  || '';
  if (d.showPrices !== undefined) { showPrices = d.showPrices; applyPricesUI(); }
  setMode(d.mode || 'DQE');
  syncPageLayoutUI();
}

/* ── Autosave ── */
function triggerAutosave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveLocal, AUTOSAVE_DELAY);
}
function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(getSaveData())); } catch(e) {}
}
function loadLocal() {
  const str = localStorage.getItem(STORAGE_KEY);
  if (!str) return false;
  try { applyLoadedData(JSON.parse(str)); return true; } catch { return false; }
}

/* ── Save project ── */
async function fileSave(saveAs) {
  const data = getSaveData();
  const json = JSON.stringify(data, null, 2);
  const defName = (data.l1 || 'devis').replace(/\s+/g, '_').substring(0, 40) + '.json';
  if (isElectron) {
    const p = saveAs
      ? await window.electronAPI.saveProjectAs(json, defName)
      : await window.electronAPI.saveProject(json, defName, currentFilePath);
    if (p) {
      currentFilePath = p;
      updateFileLabel(p);
      setSaveIndicator('saved');
      setTimeout(() => setSaveIndicator(''), 2000);
      saveLocal();
      notif('✓ Projet sauvegardé');
    }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = defName; a.click();
    notif('✓ Fichier téléchargé');
  }
}

/* ── 5-minute backup ── */
function startBackupTimer() {
  setInterval(async () => {
    if (!currentFilePath) return;
    const json = JSON.stringify(getSaveData(), null, 2);
    const p    = await window.electronAPI.saveBackup(json, currentFilePath);
    if (p) notif('🛡 Backup sauvegardé');
  }, AUTOSAVE_FILE_MS);
}

function updateFileLabel(fp) {
  const el = document.getElementById('current-file-label');
  if (el) el.textContent = fp ? '📄 ' + fp.split(/[\\/]/).pop() : '';
}

/* ════════════════════════════════════════════════
   PAGE LAYOUT — paper, margins, header, footer
   Stored in `pageLayout` object (state.js)
════════════════════════════════════════════════ */

/* Sync the layout offcanvas UI with current pageLayout values */
function syncPageLayoutUI() {
  const p = pageLayout;
  const g = id => document.getElementById(id);
  if (g('pl-size'))    g('pl-size').value    = p.size    || 'A4';
  if (g('pl-orient'))  g('pl-orient').value  = p.orient  || 'portrait';
  if (g('pl-mt'))      g('pl-mt').value      = p.mt      || 15;
  if (g('pl-mb'))      g('pl-mb').value      = p.mb      || 15;
  if (g('pl-ml'))      g('pl-ml').value      = p.ml      || 15;
  if (g('pl-mr'))      g('pl-mr').value      = p.mr      || 15;
  if (g('pl-header'))  g('pl-header').value  = p.header  || '';
  if (g('pl-footer'))  g('pl-footer').value  = p.footer  || '';
  if (g('pl-pgnum'))   g('pl-pgnum').checked = !!p.showPageNum;
  if (g('pl-date'))    g('pl-date').checked  = !!p.showDate;
}

function applyPageLayout() {
  const g  = id => document.getElementById(id);
  pageLayout.size       = g('pl-size')?.value    || 'A4';
  pageLayout.orient     = g('pl-orient')?.value  || 'portrait';
  pageLayout.mt         = parseFloat(g('pl-mt')?.value)  || 15;
  pageLayout.mb         = parseFloat(g('pl-mb')?.value)  || 15;
  pageLayout.ml         = parseFloat(g('pl-ml')?.value)  || 15;
  pageLayout.mr         = parseFloat(g('pl-mr')?.value)  || 15;
  pageLayout.header     = g('pl-header')?.value  || '';
  pageLayout.footer     = g('pl-footer')?.value  || '';
  pageLayout.showPageNum= !!g('pl-pgnum')?.checked;
  pageLayout.showDate   = !!g('pl-date')?.checked;
  triggerAutosave();
  notif('✓ Mise en page appliquée');
}

/* ════════════════════════════════════════════════
   BUILD PRINT HTML
   Captures the current rendered document with:
   - All CSS from the page (inline <style> blocks)
   - Page layout as @page CSS rule
   - Header/footer as absolute positioned elements
   - print-color-adjust: exact for background colors
════════════════════════════════════════════════ */
function buildPrintHTML() {
  const p = pageLayout;

  // Collect all <style> tags from the page
  let styles = '';
  document.querySelectorAll('style').forEach(s => { styles += s.outerHTML + '\n'; });
  // Add all <link rel="stylesheet"> hrefs as @import (for CDN fonts etc.)
  // We skip them and just collect computed styles via a simpler approach

  // @page rule with paper size and margins
  const landscape = p.orient === 'landscape';
  const pageSize  = landscape ? p.size + ' landscape' : p.size;

  const pageCss = `
<style>
  @page {
    size: ${pageSize};
    margin: ${p.mt}mm ${p.mr}mm ${p.mb}mm ${p.ml}mm;
  }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { margin: 0; padding: 0; background: #fff; font-family: 'Times New Roman', Times, serif; font-size: 12pt; }
  #appbar, #foot, #float-ctrl, .offcanvas, .offcanvas-backdrop, #toast-ct,
  #colorpop, #colpop, #layoutpop { display: none !important; }
  #wrap { padding: 0; height: auto; overflow: visible; }
  #doc  { box-shadow: none; border: none; max-width: 100%; padding: 0; }
  tr.sel-row td, tr.sel-multi td { outline: none; }
  thead { display: table-header-group; }
  tr    { page-break-inside: avoid; }
  #ttc-summary { page-break-inside: avoid; }
  ${!showPrices ? `
    #tbl .price-cell { color: transparent !important; }
    #tbl .rts .tot-val, #tbl .rtc .tot-val,
    #tbl .rgt .tot-val, #tbl .rtva .tot-val, #tbl .rttc .tot-val { color: transparent !important; }
    #ttc-summary { visibility: hidden; }
  ` : ''}
</style>`;

  // Build header/footer HTML
  const now    = new Date();
  const dateStr= now.toLocaleDateString('fr-DZ', { day:'2-digit', month:'2-digit', year:'numeric' });

  let headerHtml = '';
  let footerHtml = '';

  if (p.header || p.showDate) {
    const left  = p.header || '';
    const right = p.showDate ? dateStr : '';
    headerHtml = `
<div style="display:flex;justify-content:space-between;align-items:center;
            padding:0 0 6px 0;border-bottom:1px solid #000;margin-bottom:10px;
            font-family:'Times New Roman',Times,serif;font-size:10pt;color:#000">
  <span>${esc(left)}</span>
  <span>${esc(right)}</span>
</div>`;
  }

  if (p.footer || p.showPageNum) {
    const left  = p.footer || '';
    const right = p.showPageNum ? 'Page <span class="pageNum"></span>' : '';
    footerHtml = `
<div style="display:flex;justify-content:space-between;align-items:center;
            padding:6px 0 0 0;border-top:1px solid #000;margin-top:10px;
            font-family:'Times New Roman',Times,serif;font-size:10pt;color:#000">
  <span>${esc(left)}</span>
  <span>${right}</span>
</div>`;
  }

  // Capture the document content (doc div only)
  const docEl  = document.getElementById('doc');
  const docHtml= docEl ? docEl.outerHTML : '';

  // Gather all inline <style> content from app CSS files
  // (they were injected as <link> in Electron, so we read them directly)
  // Simpler: collect all computed stylesheets text via CSSStyleSheet API
  let allCss = '';
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) allCss += rule.cssText + '\n';
      } catch(e) { /* cross-origin sheet, skip */ }
    }
  } catch(e) {}

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>${allCss}</style>
${pageCss}
</head>
<body>
${headerHtml}
${docHtml}
${footerHtml}
<script>
// Page numbers
window.onload = function() {
  var spans = document.querySelectorAll('.pageNum');
  spans.forEach(function(s, i) { s.textContent = i + 1; });
  window.print();
  window.close();
};
<\/script>
</body>
</html>`;

  return html;
}

/* ════════════════════════════════════════════════
   PRINT — opens OS print dialog with preview
════════════════════════════════════════════════ */
async function doPrint() {
  const html = buildPrintHTML();
  if (isElectron) {
    notif('🖨 Ouverture du dialogue d\'impression…');
    await window.electronAPI.printDoc(html);
  } else {
    // Browser fallback: open in new tab
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }
}

/* ════════════════════════════════════════════════
   PDF EXPORT — save to file, no dialog
════════════════════════════════════════════════ */
async function doExportPdf() {
  const data    = getSaveData();
  const defName = (data.l1 || 'devis').replace(/\s+/g, '_').substring(0, 40) + '.pdf';
  const html    = buildPrintHTML();
  if (isElectron) {
    const p = await window.electronAPI.exportPdf(html, defName);
    if (p) notif('✓ PDF exporté');
  } else {
    window.print();
  }
}

/* ═══ ELECTRON EVENT WIRING ═══ */
if (isElectron) {
  startBackupTimer();

  window.electronAPI.onMenuNew(() => {
    if (confirm('Nouveau projet ? Les données non sauvegardées seront perdues.')) {
      rows = []; nid = 1; currentFilePath = null;
      updateFileLabel(''); render(); snapshot(); saveLocal();
    }
  });

  window.electronAPI.onMenuSave(()         => fileSave(false));
  window.electronAPI.onMenuSaveAs(()       => fileSave(true));
  window.electronAPI.onMenuExportExcel(()  => doExport());
  window.electronAPI.onMenuExportPdf(()    => doExportPdf());
  window.electronAPI.onMenuPrint(()        => doPrint());
  window.electronAPI.onMenuUndo(()         => undo());
  window.electronAPI.onMenuRedo(()         => redo());
  window.electronAPI.onMenuMode(m          => setMode(m));
  window.electronAPI.onMenuCollapseAll(v   => collapseAll(v));
  window.electronAPI.onMenuTogglePrices(() => togglePrices());

  window.electronAPI.onFileOpened(({ path, content }) => {
    try {
      const d = JSON.parse(content);
      if (!d.rows) throw new Error('Format invalide');
      applyLoadedData(d);
      currentFilePath = path;
      updateFileLabel(path);
      render(); snapshot(); saveLocal();
      notif('✓ ' + path.split(/[\\/]/).pop() + ' chargé');
    } catch (e) { notif('⚠ ' + e.message); }
  });

  window.electronAPI.onFileImportExcel(buf => importExcelBuffer(buf));
}
