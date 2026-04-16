/**
 * files.js — Save, load, backup, and print/PDF via preview window.
 *
 * buildPrintHTML():
 *   Creates a fully self-contained HTML file (no external dependencies).
 *   All CSS is inlined via document.styleSheets.
 *   A preview toolbar is injected at top with Print / PDF / Close buttons.
 *   The @page rule sets paper size + margins from pageLayout settings.
 *   This file is written to a temp path and loaded as file:// in the
 *   preview BrowserWindow — ensuring all resources load correctly.
 */

const isElectron = !!(window.electronAPI);

/* ── Data ── */
function getSaveData() {
  return {
    v: 8, rows, mode, nid, C, showPrices, pageLayout,
    tva: document.getElementById('tva').value,
    l1:  document.getElementById('hl1').value,
    l2:  document.getElementById('hl2').value,
    l3:  document.getElementById('hl3').value,
  };
}

function applyLoadedData(d) {
  rows = d.rows || []; nid = d.nid || 1;
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

/* ── Save ── */
async function fileSave(saveAs) {
  const data = getSaveData();
  const json = JSON.stringify(data, null, 2);
  const defName = (data.l1||'devis').replace(/\s+/g,'_').substring(0,40)+'.json';
  if (isElectron) {
    const p = saveAs
      ? await window.electronAPI.saveProjectAs(json, defName)
      : await window.electronAPI.saveProject(json, defName, currentFilePath);
    if (p) { currentFilePath=p; updateFileLabel(p); setSaveIndicator('saved'); setTimeout(()=>setSaveIndicator(''),2000); saveLocal(); notif('✓ Sauvegardé'); }
  } else {
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([json],{type:'application/json'})); a.download=defName; a.click();
  }
}

/* ── 5-min backup ── */
function startBackupTimer() {
  setInterval(async () => {
    if (!currentFilePath) return;
    await window.electronAPI.saveBackup(JSON.stringify(getSaveData(),null,2), currentFilePath);
  }, AUTOSAVE_FILE_MS);
}

function updateFileLabel(fp) {
  const el=document.getElementById('current-file-label');
  if(el) el.textContent=fp?'📄 '+fp.split(/[\\/]/).pop():'';
}

/* ════════════════════════════════════════
   PAGE LAYOUT
════════════════════════════════════════ */
function syncPageLayoutUI() {
  const p=pageLayout, g=id=>document.getElementById(id);
  if(g('pl-size'))   g('pl-size').value   =p.size   ||'A4';
  if(g('pl-orient')) g('pl-orient').value =p.orient ||'portrait';
  if(g('pl-mt'))     g('pl-mt').value     =p.mt     ??15;
  if(g('pl-mb'))     g('pl-mb').value     =p.mb     ??15;
  if(g('pl-ml'))     g('pl-ml').value     =p.ml     ??15;
  if(g('pl-mr'))     g('pl-mr').value     =p.mr     ??15;
  if(g('pl-header')) g('pl-header').value =p.header ||'';
  if(g('pl-footer')) g('pl-footer').value =p.footer ||'';
  if(g('pl-pgnum'))  g('pl-pgnum').checked=!!p.showPageNum;
  if(g('pl-date'))   g('pl-date').checked =!!p.showDate;
}

function applyPageLayout() {
  const g=id=>document.getElementById(id);
  pageLayout.size       =g('pl-size')?.value   ||'A4';
  pageLayout.orient     =g('pl-orient')?.value ||'portrait';
  pageLayout.mt         =parseFloat(g('pl-mt')?.value) ||15;
  pageLayout.mb         =parseFloat(g('pl-mb')?.value) ||15;
  pageLayout.ml         =parseFloat(g('pl-ml')?.value) ||15;
  pageLayout.mr         =parseFloat(g('pl-mr')?.value) ||15;
  pageLayout.header     =g('pl-header')?.value ||'';
  pageLayout.footer     =g('pl-footer')?.value ||'';
  pageLayout.showPageNum=!!g('pl-pgnum')?.checked;
  pageLayout.showDate   =!!g('pl-date')?.checked;
  triggerAutosave();
  notif('✓ Mise en page appliquée');
}

/* ════════════════════════════════════════
   BUILD PRINT HTML
   
   Generates a fully self-contained HTML file:
   - All CSS collected from document.styleSheets (inline)
   - @page rule with paper size + margins
   - Header/footer with date and page numbers
   - A preview toolbar (hidden in actual print via @media print)
   - The document content (#doc element)
   - TTC summary lines
   
   No external URLs — works as file:// without internet.
════════════════════════════════════════ */
function buildPrintHTML() {
  const p       = pageLayout;
  const landscape = p.orient === 'landscape';
  const pageSize  = landscape ? (p.size + ' landscape') : p.size;
  const data      = getSaveData();
  const projName  = data.l1 || 'Devis BTP';
  const now       = new Date();
  const dateStr   = now.toLocaleDateString('fr-DZ',{day:'2-digit',month:'2-digit',year:'numeric'});

  /* 1. Collect ALL CSS from the page (inline + linked stylesheets) */
  let allCss = '';
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) allCss += rule.cssText + '\n';
      } catch(e) { /* cross-origin, skip */ }
    }
  } catch(e) {}

  /* 2. @page rule */
  const pageCss = `
@page {
  size: ${pageSize};
  margin: ${p.mt}mm ${p.mr}mm ${p.mb}mm ${p.ml}mm;
}`;

  /* 3. Print-specific overrides */
  const printOverrideCss = `
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
body { margin: 0; padding: 0; background: #fff !important; }
#preview-toolbar { display: none !important; }
#appbar, #foot, #float-ctrl, .offcanvas, .offcanvas-backdrop,
#toast-ct, #colorpop, #colpop, #layoutpop { display: none !important; }
#wrap { padding: 0 !important; height: auto !important; overflow: visible !important; background: #fff !important; }
#doc  { box-shadow: none !important; border: none !important; max-width: 100% !important; padding: 0 !important; }
tr.sel-row td, tr.sel-multi td { outline: none !important; }
thead { display: table-header-group; }
tr    { page-break-inside: avoid; }
#ttc-summary { page-break-inside: avoid; }
${!showPrices ? `
  #tbl .price-cell { color: transparent !important; }
  #tbl .rts .tot-val, #tbl .rtc .tot-val,
  #tbl .rgt .tot-val, #tbl .rtva .tot-val, #tbl .rttc .tot-val { color: transparent !important; }
  #ttc-summary { visibility: hidden !important; }
` : ''}`;

  /* 4. Preview toolbar styles (visible only in preview window, hidden on print) */
  const previewBarCss = `
#preview-toolbar {
  position: sticky; top: 0; z-index: 9999;
  background: #1e2535; color: #fff;
  padding: 10px 16px; display: flex; align-items: center; gap: 10px;
  font-family: sans-serif; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,.4);
}
#preview-toolbar .ptitle { flex: 1; font-weight: bold; font-size: 13px; opacity: .8; }
#preview-toolbar button {
  padding: 7px 16px; border: none; border-radius: 5px;
  font-family: sans-serif; font-size: 12px; font-weight: bold; cursor: pointer;
}
.pbtn-print { background: #1a56a0; color: #fff; }
.pbtn-print:hover { background: #2266c0; }
.pbtn-pdf   { background: #c0392b; color: #fff; }
.pbtn-pdf:hover   { background: #e74c3c; }
.pbtn-close { background: #444; color: #ccc; }
.pbtn-close:hover { background: #666; }
.pbtn-hint  { font-size: 10px; color: #7a90b0; }`;

  /* 5. Capture the document HTML (#doc element only) */
  const docEl   = document.getElementById('doc');
  const docHtml = docEl ? docEl.outerHTML : '<p>Document vide</p>';

  /* 6. TTC summary (if not already inside #doc — it is in index.html) */
  // It's inside #doc, so it will be captured with docHtml ✓

  /* 7. Header / Footer running elements */
  const headerLeft  = p.header || projName;
  const headerRight = p.showDate ? dateStr : '';
  const footerLeft  = p.footer || '';

  const runningHeaderHtml = (p.header || p.showDate) ? `
  <div style="display:flex;justify-content:space-between;padding:0 0 8px;border-bottom:1px solid #000;margin-bottom:12px;font-family:'Times New Roman',Times,serif;font-size:10pt;color:#000">
    <span>${esc(headerLeft)}</span><span>${esc(headerRight)}</span>
  </div>` : '';

  const runningFooterHtml = (p.footer || p.showPageNum) ? `
  <div style="display:flex;justify-content:space-between;padding:8px 0 0;border-top:1px solid #ccc;margin-top:16px;font-family:'Times New Roman',Times,serif;font-size:10pt;color:#000">
    <span>${esc(footerLeft)}</span>
    ${p.showPageNum ? '<span id="pg-num" style="font-weight:bold"></span>' : ''}
  </div>` : '';

  /* 8. Assemble the final HTML */
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(projName)} — Aperçu impression</title>
<style>
${allCss}
</style>
<style id="page-style">
${pageCss}
</style>
<style media="print">
${printOverrideCss}
</style>
<style>
${previewBarCss}
/* Screen-only document padding */
body { background: #888 !important; }
#doc-wrap { background: #fff; max-width: 960px; margin: 20px auto; padding: 20px 24px 32px; box-shadow: 0 4px 24px rgba(0,0,0,.35); }
#doc { box-shadow: none !important; border: none !important; max-width: 100% !important; }
</style>
</head>
<body>

<!-- PREVIEW TOOLBAR (hidden when printing) -->
<div id="preview-toolbar">
  <span class="ptitle">📄 Aperçu — ${esc(projName)}</span>
  <span class="pbtn-hint">Cliquez Imprimer pour choisir l'imprimante et voir l'aperçu système</span>
  <button class="pbtn-print" onclick="doPrint()">🖨 Imprimer…</button>
  <button class="pbtn-pdf"   onclick="doPdf()">⬇ Exporter PDF…</button>
  <button class="pbtn-close" onclick="doClose()">✕ Fermer</button>
</div>

<!-- DOCUMENT -->
<div id="doc-wrap">
  ${runningHeaderHtml}
  ${docHtml}
  ${runningFooterHtml}
</div>

<script>
var projName = ${JSON.stringify(projName)};

// Preview toolbar actions
function doPrint() {
  if (window.previewAPI) {
    window.previewAPI.print().then(function(ok) {
      if (!ok) alert('Impression annulée ou erreur.');
    });
  } else {
    window.print();
  }
}

function doPdf() {
  var defName = projName.replace(/\\s+/g,'_').substring(0,40)+'.pdf';
  if (window.previewAPI) {
    window.previewAPI.exportPdf(defName);
  } else {
    window.print();
  }
}

function doClose() {
  if (window.previewAPI) window.previewAPI.close();
  else window.close();
}

// Page numbers
(function() {
  var el = document.getElementById('pg-num');
  if (el) el.textContent = 'Page 1';
})();

// Keyboard shortcuts in preview
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey||e.metaKey) && e.key==='p') { e.preventDefault(); doPrint(); }
  if (e.key==='Escape') doClose();
});
<\/script>
</body>
</html>`;

  return html;
}

/* ════════════════════════════════════════
   PUBLIC ACTIONS
════════════════════════════════════════ */

/** Open the preview window (print + PDF available from there) */
async function doPreview() {
  const html = buildPrintHTML();
  if (isElectron) {
    notif('📄 Ouverture de l\'aperçu…');
    await window.electronAPI.openPreview(html);
  } else {
    // Browser: open in new tab
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }
}

/** Legacy aliases — both now go through the preview */
const doPrint     = doPreview;
const doExportPdf = doPreview;

/* ═══ ELECTRON WIRING ═══ */
if (isElectron) {
  startBackupTimer();

  window.electronAPI.onMenuNew(() => {
    if (confirm('Nouveau projet ? Données non sauvegardées seront perdues.')) {
      rows=[]; nid=1; currentFilePath=null; updateFileLabel(''); render(); snapshot(); saveLocal();
    }
  });
  window.electronAPI.onMenuSave(()        => fileSave(false));
  window.electronAPI.onMenuSaveAs(()      => fileSave(true));
  window.electronAPI.onMenuExportExcel(() => doExport());
  window.electronAPI.onMenuPreview(()     => doPreview());
  window.electronAPI.onMenuUndo(()        => undo());
  window.electronAPI.onMenuRedo(()        => redo());
  window.electronAPI.onMenuMode(m         => setMode(m));
  window.electronAPI.onMenuCollapseAll(v  => collapseAll(v));
  window.electronAPI.onMenuTogglePrices(()=> togglePrices());

  window.electronAPI.onFileOpened(({ path, content }) => {
    try {
      const d = JSON.parse(content);
      if (!d.rows) throw new Error('Format invalide');
      applyLoadedData(d);
      currentFilePath = path; updateFileLabel(path);
      render(); snapshot(); saveLocal();
      notif('✓ '+path.split(/[\\/]/).pop()+' chargé');
    } catch(e) { notif('⚠ '+e.message); }
  });

  window.electronAPI.onFileImportExcel(buf => importExcelBuffer(buf));
}
