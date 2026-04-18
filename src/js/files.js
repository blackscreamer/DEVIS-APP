/**
 * files.js
 *
 * buildPrintHTML() strategy:
 *   Instead of extracting CSS from the DOM (unreliable in Electron file://),
 *   we rebuild the entire print document from scratch using the data in `rows[]`.
 *   All styles are hardcoded inline — no external dependencies.
 *   The output looks exactly like the target image: clean A4, black borders,
 *   Times New Roman, correct colors per row type.
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
  const data    = getSaveData();
  const json    = JSON.stringify(data, null, 2);
  const defName = (data.l1||'devis').replace(/\s+/g,'_').substring(0,40)+'.json';
  if (isElectron) {
    const p = saveAs
      ? await window.electronAPI.saveProjectAs(json, defName)
      : await window.electronAPI.saveProject(json, defName, currentFilePath);
    if (p) {
      currentFilePath = p; updateFileLabel(p);
      setSaveIndicator('saved'); setTimeout(()=>setSaveIndicator(''),2000);
      saveLocal(); notif('✓ Sauvegardé');
    }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json],{type:'application/json'}));
    a.download = defName; a.click();
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
  const el = document.getElementById('current-file-label');
  if (el) el.textContent = fp ? '📄 '+fp.split(/[\\/]/).pop() : '';
}

/* ── Page layout UI ── */
function syncPageLayoutUI() {
  const p = pageLayout, g = id => document.getElementById(id);
  if(g('pl-size'))   g('pl-size').value    = p.size    || 'A4';
  if(g('pl-orient')) g('pl-orient').value  = p.orient  || 'portrait';
  if(g('pl-mt'))     g('pl-mt').value      = p.mt      ?? 15;
  if(g('pl-mb'))     g('pl-mb').value      = p.mb      ?? 15;
  if(g('pl-ml'))     g('pl-ml').value      = p.ml      ?? 15;
  if(g('pl-mr'))     g('pl-mr').value      = p.mr      ?? 15;
  if(g('pl-header')) g('pl-header').value  = p.header  || '';
  if(g('pl-footer')) g('pl-footer').value  = p.footer  || '';
  if(g('pl-pgnum'))  g('pl-pgnum').checked = !!p.showPageNum;
  if(g('pl-date'))   g('pl-date').checked  = !!p.showDate;
}

function applyPageLayout() {
  const g = id => document.getElementById(id);
  pageLayout.size       = g('pl-size')?.value   || 'A4';
  pageLayout.orient     = g('pl-orient')?.value || 'portrait';
  pageLayout.mt         = parseFloat(g('pl-mt')?.value)  || 15;
  pageLayout.mb         = parseFloat(g('pl-mb')?.value)  || 15;
  pageLayout.ml         = parseFloat(g('pl-ml')?.value)  || 15;
  pageLayout.mr         = parseFloat(g('pl-mr')?.value)  || 15;
  pageLayout.header     = g('pl-header')?.value || '';
  pageLayout.footer     = g('pl-footer')?.value || '';
  pageLayout.showPageNum= !!g('pl-pgnum')?.checked;
  pageLayout.showDate   = !!g('pl-date')?.checked;
  triggerAutosave();
  notif('✓ Mise en page appliquée');
}

/* ════════════════════════════════════════════════════════
   BUILD PRINT HTML
   
   Rebuilds the entire document from rows[] data with all
   styles hardcoded inline. No external CSS dependencies.
   Matches the target layout: A4, Times New Roman, black
   borders, colored rows, totals, TTC summary lines.
════════════════════════════════════════════════════════ */
function buildPrintHTML() {
  const p         = pageLayout;
  const isBPU     = mode === 'BPU';
  const landscape = p.orient === 'landscape';
  const pageSize  = landscape ? p.size + ' landscape' : p.size;
  const l1        = document.getElementById('hl1').value;
  const l2        = document.getElementById('hl2').value;
  const l3        = document.getElementById('hl3').value;
  const tvaVal    = num(document.getElementById('tva').value);
  const projName  = l1 || 'Devis BTP';
  const now       = new Date();
  const dateStr   = now.toLocaleDateString('fr-DZ',{day:'2-digit',month:'2-digit',year:'numeric'});

  // ── Numbering ──
  const { nums, letters } = buildNums();

  // ── Totals ──
  const { chapT, subT } = computeTotals();
  const grand   = grandTotal();
  const tvaAmt  = grand * tvaVal / 100;
  const ttcVal  = grand + tvaAmt;

  // ── Cell style helpers (all inline) ──
  const F    = "'Times New Roman', Times, serif";
  const SZ   = '11pt';
  const BD   = '1px solid #000';
  const CELL = `font-family:${F};font-size:${SZ};padding:3px 5px;border:${BD};vertical-align:middle;`;
  const NUM_CELL = CELL + 'text-align:right;font-weight:bold;white-space:nowrap;';
  const hide = !showPrices;

  // ── Row builders ──
  function chapRow(r, n) {
    const bg = C.chapBg, fg = C.chapFg;
    const span = isBPU ? 3 : 6;
    return `<tr>
      <td style="${CELL}background:${bg};color:${fg};text-align:center;font-weight:bold;font-size:11pt" colspan="${span}">
        ${esc(r.desig||'')}
      </td>
    </tr>`;
  }

  function subRow(r, n) {
    const lv = r.level || 1;
    const bg = lv===1 ? C.sub1Bg : lv===2 ? C.sub2Bg : C.sub3Bg;
    const fg = lv===1 ? C.sub1Fg : lv===2 ? C.sub2Fg : C.sub3Fg;
    const pl = 6 + (lv-1)*14;
    const span = isBPU ? 2 : 5;
    return `<tr>
      <td style="${CELL}background:${bg};color:${fg};font-weight:bold;text-align:center;">${esc(n)}</td>
      <td style="${CELL}background:${bg};color:${fg};font-weight:bold;padding-left:${pl}px;text-transform:uppercase;" colspan="${span}">
        ${esc(r.desig||'')}
      </td>
    </tr>`;
  }

  function artRow(r, n) {
    const hasKids = artHasSubarts(r.id);
    const t = hasKids ? 0 : artTotal(r);
    const bg  = C.artBg, fg = C.artFg;
    if (isBPU) {
      const bDesig  = r.bpu_desig  !== undefined ? r.bpu_desig  : r.desig;
      const bPu     = r.bpu_pu     !== undefined ? r.bpu_pu     : r.pu;
      const bUnite  = r.bpu_unite  !== undefined ? r.bpu_unite  : r.unite;
      const subline = !hasKids ? buildBpuSubline(bUnite, num(bPu)) : '';
      return `<tr>
        <td style="${CELL}background:${bg};color:${fg};text-align:center;">${esc(n)}</td>
        <td style="${CELL}background:${bg};color:${fg};">${esc(bDesig)}${subline?`<br/><em style="font-size:9pt">${esc(subline)}</em>`:''}</td>
        <td style="${NUM_CELL}background:${bg};color:${fg};">${!hasKids&&!hide ? daNoUnit(num(bPu)) : ''}</td>
      </tr>`;
    }
    return `<tr>
      <td style="${CELL}background:${bg};color:${fg};text-align:center;">${esc(n)}</td>
      <td style="${CELL}background:${bg};color:${fg};">${esc(r.desig||'')}</td>
      <td style="${CELL}background:${bg};color:${fg};text-align:center;">${hasKids?'':esc(r.unite||'')}</td>
      <td style="${NUM_CELL}background:${bg};color:${fg};">${hasKids?'':fmtNum(r.qty)}</td>
      <td style="${NUM_CELL}background:${bg};color:${fg};">${hasKids||hide?'':daNoUnit(num(r.pu))}</td>
      <td style="${NUM_CELL}background:${bg};color:${fg};">${t&&!hide?daNoUnit(t):''}</td>
    </tr>`;
  }

  function subartRow(r, letter) {
    const t = artTotal(r);
    const bg = C.saBg, fg = C.saFg;
    if (isBPU) {
      const bDesig = r.bpu_desig !== undefined ? r.bpu_desig : r.desig;
      const bPu    = r.bpu_pu   !== undefined ? r.bpu_pu   : r.pu;
      const bUnite = r.bpu_unite!== undefined ? r.bpu_unite: r.unite;
      const subline= buildBpuSubline(bUnite, num(bPu));
      return `<tr>
        <td style="${CELL}background:${bg};color:${fg};text-align:center;">${esc(letter)}</td>
        <td style="${CELL}background:${bg};color:${fg};padding-left:18px;">${esc(bDesig)}${subline?`<br/><em style="font-size:9pt">${esc(subline)}</em>`:''}</td>
        <td style="${NUM_CELL}background:${bg};color:${fg};">${!hide?daNoUnit(num(bPu)):''}</td>
      </tr>`;
    }
    return `<tr>
      <td style="${CELL}background:${bg};color:${fg};text-align:center;">${esc(letter)}</td>
      <td style="${CELL}background:${bg};color:${fg};padding-left:18px;">${esc(r.desig||'')}</td>
      <td style="${CELL}background:${bg};color:${fg};text-align:center;">${esc(r.unite||'')}</td>
      <td style="${NUM_CELL}background:${bg};color:${fg};">${fmtNum(r.qty)}</td>
      <td style="${NUM_CELL}background:${bg};color:${fg};">${!hide?daNoUnit(num(r.pu)):''}</td>
      <td style="${NUM_CELL}background:${bg};color:${fg};">${t&&!hide?daNoUnit(t):''}</td>
    </tr>`;
  }

  function blankRow(r) {
    const span = isBPU ? 3 : 6;
    return `<tr><td colspan="${span}" style="${CELL}font-style:italic;color:#444;">${esc(r.desig||'')}</td></tr>`;
  }

  function subTotRow(desig, total) {
    const bg = C.tsBg, fg = C.tsFg;
    const span = isBPU ? 2 : 5;
    return `<tr>
      <td colspan="${span}" style="${CELL}background:${bg};color:${fg};font-weight:bold;text-align:right;text-transform:uppercase;border-top:2px solid #50a050;">
        Total ${esc(desig)}
      </td>
      <td style="${NUM_CELL}background:${bg};color:${fg};border-top:2px solid #50a050;">${!hide?daNoUnit(total):''}</td>
    </tr>`;
  }

  function chapTotRow(desig, total) {
    const bg = C.tcBg, fg = C.tcFg;
    const span = isBPU ? 2 : 5;
    return `<tr>
      <td colspan="${span}" style="${CELL}background:${bg};color:${fg};font-weight:bold;font-size:11pt;text-align:right;text-transform:uppercase;border-top:2px solid #30a030;">
        Total ${esc(desig)}
      </td>
      <td style="${NUM_CELL}background:${bg};color:${fg};font-size:11pt;border-top:2px solid #30a030;">${!hide?daNoUnit(total):''}</td>
    </tr>`;
  }

  // ── Build table rows ──
  let tableRows = '';
  let chapStk = [], subStk = [];

  const flushSubs = () => {
    while (subStk.length) {
      const s = subStk.pop();
      tableRows += subTotRow(s.desig, subT[s.id]||0);
    }
  };
  const flushChap = () => {
    if (!chapStk.length) return;
    const c = chapStk.pop();
    tableRows += chapTotRow(c.desig, chapT[c.id]||0);
  };

  rows.forEach((r, i) => {
    const n      = nums[i];
    const letter = letters[i];

    if (r.type === 'chap') {
      flushSubs(); flushChap();
      chapStk.push({ id: r.id, desig: r.desig });
      tableRows += chapRow(r, n);
    } else if (r.type === 'sub') {
      const lv = r.level || 1;
      while (subStk.length && subStk[subStk.length-1].level >= lv) {
        const s = subStk.pop();
        tableRows += subTotRow(s.desig, subT[s.id]||0);
      }
      subStk.push({ id: r.id, desig: r.desig, level: lv });
      tableRows += subRow(r, n);
    } else if (r.type === 'art') {
      tableRows += artRow(r, n);
    } else if (r.type === 'subart') {
      tableRows += subartRow(r, letter);
    } else if (r.type === 'blank') {
      tableRows += blankRow(r);
    }
  });

  flushSubs(); flushChap();

  // ── Grand total rows ──
  const gtBg = C.gtBg, gtFg = C.gtFg;
  const span5 = isBPU ? 2 : 5;
  if (!isBPU) {
    tableRows += `
    <tr>
      <td colspan="${span5}" style="${CELL}background:${gtBg};color:${gtFg};font-weight:bold;font-size:12pt;text-align:right;text-transform:uppercase;border-top:3px solid #060;">TOTAL GÉNÉRAL HT</td>
      <td style="${NUM_CELL}background:${gtBg};color:${gtFg};font-size:12pt;border-top:3px solid #060;">${!hide?daNoUnit(grand):''}</td>
    </tr>
    <tr>
      <td colspan="${span5}" style="${CELL}background:${gtBg};color:${gtFg};font-weight:bold;text-align:right;">TVA (${tvaVal}%)</td>
      <td style="${NUM_CELL}background:${gtBg};color:${gtFg};">${!hide?daNoUnit(tvaAmt):''}</td>
    </tr>
    <tr>
      <td colspan="${span5}" style="${CELL}background:${gtBg};color:${gtFg};font-weight:bold;font-size:12pt;text-align:right;text-transform:uppercase;border-top:2px solid #000;">TOTAL TTC</td>
      <td style="${NUM_CELL}background:${gtBg};color:${gtFg};font-size:12pt;border-top:2px solid #000;">${!hide?da(ttcVal):''}</td>
    </tr>`;
  }

  // ── Column headers ──
  const thead = isBPU
    ? `<tr style="background:#d9d9d9;">
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;width:60px;">N°</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;">DESIGNATION DES OUVRAGES</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;width:120px;">${!hide?'PRIX UNITAIRE HT':''}</th>
      </tr>`
    : `<tr style="background:#d9d9d9;">
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;width:60px;">N°</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;">DESIGNATION DES OUVRAGES</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;width:40px;">U</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:right;width:80px;">QUANTITE</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:right;width:95px;">${!hide?'P.U EN HT':''}</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:right;width:110px;">MONTANT HT</th>
      </tr>`;

  // ── TTC summary lines ──
  const ttcSummary = (!isBPU && ttcVal) ? `
  <div style="margin-top:20px;font-family:${F};font-size:11pt;color:#000;line-height:2.4;border-top:2px solid #000;padding-top:12px;">
    <div>
      <span>Le montant total TTC en chiffres&nbsp;: </span>
      <strong>${!hide ? da(ttcVal) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</strong>
    </div>
    <div>
      <span>Le montant total TTC en lettres&nbsp;: </span>
      <strong><em>${!hide ? numToWordsFr(Math.floor(ttcVal)) + ' DINARS ALGÉRIENS' + (Math.round((ttcVal-Math.floor(ttcVal))*100)>0?' ET '+numToWordsFr(Math.round((ttcVal-Math.floor(ttcVal))*100))+' CENTIMES':'') : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</em></strong>
    </div>
  </div>` : '';

  // ── Header / footer lines ──
  const hdrHtml = (p.header||p.showDate) ? `
  <div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid #000;margin-bottom:12px;font-family:${F};font-size:10pt;">
    <span>${esc(p.header||projName)}</span><span>${p.showDate?dateStr:''}</span>
  </div>` : '';

  const ftrHtml = (p.footer||p.showPageNum) ? `
  <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #ccc;margin-top:16px;font-family:${F};font-size:10pt;">
    <span>${esc(p.footer||'')}</span>
    ${p.showPageNum?'<span id="pg-num">Page 1</span>':''}
  </div>` : '';

  // ── Full HTML ──
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>${esc(projName)} — Aperçu</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page {
  size: ${pageSize};
  margin: ${p.mt}mm ${p.mr}mm ${p.mb}mm ${p.ml}mm;
}
body {
  font-family: ${F};
  font-size: ${SZ};
  background: #888;
  color: #000;
}
/* Preview wrapper (hidden when printing) */
#pv-bar {
  position: sticky; top: 0; z-index: 9999;
  background: #1e2535; padding: 10px 18px;
  display: flex; align-items: center; gap: 10px;
  font-family: sans-serif; font-size: 13px;
  box-shadow: 0 2px 8px rgba(0,0,0,.4);
}
#pv-bar .pv-title { flex:1; color:#ccc; font-weight:bold; }
#pv-bar button {
  padding: 7px 18px; border: none; border-radius: 5px;
  font-family: sans-serif; font-size: 12px; font-weight: bold; cursor: pointer;
}
.pb-print { background:#1a56a0; color:#fff; }
.pb-print:hover { background:#2266c0; }
.pb-pdf   { background:#c0392b; color:#fff; }
.pb-pdf:hover   { background:#e74c3c; }
.pb-close { background:#555; color:#ccc; }
.pb-close:hover { background:#777; }
#page-wrap {
  background: #fff;
  max-width: 860px;
  margin: 20px auto;
  padding: 24px 28px 32px;
  box-shadow: 0 4px 28px rgba(0,0,0,.4);
  min-height: 600px;
}
/* Document header */
.doc-titles { text-align: center; margin-bottom: 12px; }
.doc-t1 { font-size:12pt; font-weight:bold; text-transform:uppercase; text-decoration:underline; line-height:1.7; }
.doc-t2 { font-size:11pt; font-weight:bold; text-transform:uppercase; line-height:1.6; }
.doc-band { border:2px solid #000; padding:5px; text-align:center; font-weight:bold; font-size:12pt; text-transform:uppercase; margin-bottom:10px; }
/* Table */
table { width:100%; border-collapse:collapse; font-family:${F}; font-size:${SZ}; }
/* Print overrides */
@media print {
  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
  body { background:#fff!important; }
  #pv-bar { display:none!important; }
  #page-wrap { margin:0!important; padding:0!important; max-width:100%!important; box-shadow:none!important; }
  thead { display:table-header-group; }
  tr { page-break-inside:avoid; }
  .ttc-summary { page-break-inside:avoid; }
}
</style>
</head>
<body>

<!-- PREVIEW BAR -->
<div id="pv-bar">
  <span class="pv-title">📄 Aperçu — ${esc(projName)}</span>
  <span style="font-size:10px;color:#7a90b0">Choisissez votre imprimante dans le dialogue système</span>
  <button class="pb-print" onclick="doPrint()">🖨&nbsp; Imprimer…</button>
  <button class="pb-pdf"   onclick="doPdf()">⬇&nbsp; PDF…</button>
  <button class="pb-close" onclick="doClose()">✕&nbsp; Fermer</button>
</div>

<!-- PAGE -->
<div id="page-wrap">
  ${hdrHtml}

  <!-- Project titles -->
  <div class="doc-titles">
    ${l1?`<div class="doc-t1">${esc(l1)}</div>`:''}
    ${l2?`<div class="doc-t2">${esc(l2)}</div>`:''}
    ${l3?`<div class="doc-t2">${esc(l3)}</div>`:''}
  </div>
  <div class="doc-band">${isBPU?'BORDEREAU DES PRIX UNITAIRES':'DETAIL QUANTITATIF ESTIMATIF'}</div>

  <!-- Table -->
  <table>
    <thead>${thead}</thead>
    <tbody>${tableRows}</tbody>
  </table>

  ${ttcSummary}
  ${ftrHtml}
</div>

<script>
var projName = ${JSON.stringify(projName)};

function doPrint() {
  if (window.previewAPI) {
    window.previewAPI.print();
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

document.addEventListener('keydown', function(e){
  if((e.ctrlKey||e.metaKey)&&e.key==='p'){ e.preventDefault(); doPrint(); }
  if(e.key==='Escape') doClose();
});
<\/script>
</body>
</html>`;
}

/* ════════════════════════════════════════
   PUBLIC ACTIONS
════════════════════════════════════════ */
async function doPreview() {
  const html = buildPrintHTML();
  if (isElectron) {
    notif('📄 Ouverture de l\'aperçu…');
    await window.electronAPI.openPreview(html);
  } else {
    const w = window.open('','_blank');
    w.document.write(html); w.document.close();
  }
}

/* Both print and PDF now go through the preview window */
const doPrint     = doPreview;
const doExportPdf = doPreview;

/* ═══ ELECTRON WIRING ═══ */
if (isElectron) {
  startBackupTimer();

  window.electronAPI.onMenuNew(() => {
    if(confirm('Nouveau projet ? Données non sauvegardées seront perdues.')) {
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
      applyLoadedData(d); currentFilePath=path; updateFileLabel(path);
      render(); snapshot(); saveLocal();
      notif('✓ '+path.split(/[\\/]/).pop()+' chargé');
    } catch(e) { notif('⚠ '+e.message); }
  });

  window.electronAPI.onFileImportExcel(buf => importExcelBuffer(buf));
}
