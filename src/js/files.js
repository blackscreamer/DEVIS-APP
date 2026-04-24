/**
 * files.js — Save, load, backup, print (browser), PDF (Electron IPC).
 *
 * PRINT:
 *   buildPrintHTML() creates a complete self-contained HTML with all CSS inline.
 *   In Electron: sent to main.js → written to temp file → shell.openExternal()
 *   → opens in user's default browser → browser's native print dialog.
 *   User gets: full preview, printer selection, copies, margins, PDF option.
 *
 * PDF:
 *   Same HTML sent to main.js → hidden BrowserWindow loads it as file://
 *   → printToPDF() → saved to disk → opened in default PDF viewer.
 */

const isElectron = !!(window.electronAPI);

/* ── Data ── */
function getSaveData() {
  return {
    v: 9, rows, mode, nid, C, showPrices, pageLayout, colWidths, headerLines,
    tva: document.getElementById('tva').value,
  };
}

function applyLoadedData(d) {
  rows = d.rows || [];
  nid  = d.nid  || 1;

  // Clean up subart rows whose desig was corrupted by old bug
  // (letter like "a) " was prepended to desig in render and saved back)
  rows.forEach(r => {
    if (r.type === 'subart' && r.desig) {
      // Remove leading "a) ", "b) ", etc. that may have been saved
      r.desig  = r.desig.replace(/^[a-z]\)\s*/i, '');
      if (r.bpu_desig) r.bpu_desig = r.bpu_desig.replace(/^[a-z]\)\s*/i, '');
    }
  });

  if (d.C) C = d.C;
  if (d.pageLayout) Object.assign(pageLayout, d.pageLayout);
  if (d.colWidths && typeof d.colWidths === 'object') {
    if (d.colWidths.DQE) Object.assign(colWidths.DQE, d.colWidths.DQE);
    if (d.colWidths.BPU) Object.assign(colWidths.BPU, d.colWidths.BPU);
  }

  // Header lines — supports all old formats
  if (d.headerLines && Array.isArray(d.headerLines) && d.headerLines.length > 0) {
    headerLines = d.headerLines.map(l => ({
      text:  typeof l.text  === 'string' ? l.text  : '',
      style: l.style === 't1' || l.style === 't2' ? l.style : 't2',
    }));
  } else {
    // Migrate from old l1/l2/l3 format (v1–v8)
    headerLines = [];
    if (d.l1) headerLines.push({ text: d.l1, style: 't1' });
    if (d.l2) headerLines.push({ text: d.l2, style: 't2' });
    if (d.l3) headerLines.push({ text: d.l3, style: 't2' });
    // Even older: might be stored as proj, l2 etc.
    if (!headerLines.length && d.projet) headerLines.push({ text: d.projet, style: 't1' });
    // Always ensure at least 2 lines
    while (headerLines.length < 2) headerLines.push({ text: '', style: headerLines.length === 0 ? 't1' : 't2' });
  }

  document.getElementById('tva').value = d.tva || 19;
  if (d.showPrices !== undefined) { showPrices = d.showPrices; applyPricesUI(); }

  setMode(d.mode || 'DQE');
  syncPageLayoutUI();
  if (typeof updateWorkspaceSize === 'function') updateWorkspaceSize();
  if (typeof renderHeaderLines   === 'function') renderHeaderLines();
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
      setSaveIndicator('saved'); setTimeout(()=>setSaveIndicator(''), 2000);
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
  if (typeof updateWorkspaceSize === 'function') updateWorkspaceSize();
  triggerAutosave();
  notif('✓ Mise en page appliquée');
}

/* ════════════════════════════════════════════
   BUILD PRINT HTML
   
   Generates a fully self-contained HTML document
   from rows[] data. All styles are inline — no
   external dependencies. Works in any browser.
   
   The @page CSS rule sets paper size and margins.
   print-color-adjust: exact preserves all colors.
════════════════════════════════════════════ */
function buildPrintHTML() {
  const p         = pageLayout;
  const isBPU     = mode === 'BPU';
  const landscape = p.orient === 'landscape';
  const pageSize  = landscape ? p.size + ' landscape' : p.size;
  const projName  = (headerLines[0]?.text) || 'Devis BTP';
  const tvaVal    = num(document.getElementById('tva').value);
  const now       = new Date();
  const dateStr   = now.toLocaleDateString('fr-DZ',{day:'2-digit',month:'2-digit',year:'numeric'});

  const { nums, letters } = buildNums();
  const { chapT, subT }   = computeTotals();
  const grand   = grandTotal();
  const tvaAmt  = grand * tvaVal / 100;
  const ttcVal  = grand + tvaAmt;
  const hide    = !showPrices;

  // Cell style constants
  const F    = "'Times New Roman', Times, serif";
  const SZ   = '11pt';
  const BD   = '1px solid #000';
  const CELL = `font-family:${F};font-size:${SZ};padding:3px 5px;border:${BD};vertical-align:middle;color:#000;white-space:pre-wrap;word-break:break-word;`;
  const NCELL= `font-family:${F};font-size:${SZ};padding:3px 5px;border:${BD};vertical-align:middle;color:#000;text-align:right;font-weight:bold;white-space:nowrap;`;

  // Escape HTML but preserve newlines as <br/>
  const escNl = s => esc(s||'').replace(/\n/g,'<br/>');

  // Row builders
  const chapRow = (r) => {
    const span = isBPU ? 3 : 6;
    return `<tr><td colspan="${span}" style="${CELL}background:${C.chapBg};color:${C.chapFg};text-align:center;font-weight:bold;font-size:12pt;text-transform:uppercase;">${escNl(r.desig||'')}</td></tr>`;
  };

  const subRow = (r, n) => {
    const lv = r.level||1;
    const bg = lv===1?C.sub1Bg:lv===2?C.sub2Bg:C.sub3Bg;
    const fg = lv===1?C.sub1Fg:lv===2?C.sub2Fg:C.sub3Fg;
    const pl = 6+(lv-1)*14;
    const span = isBPU ? 2 : 5;
    return `<tr>
      <td style="${CELL}background:${bg};color:${fg};font-weight:bold;text-align:center;">${esc(n)}</td>
      <td colspan="${span}" style="${CELL}background:${bg};color:${fg};font-weight:bold;padding-left:${pl}px;text-transform:uppercase;">${escNl(r.desig||'')}</td>
    </tr>`;
  };

  const artRow = (r, n) => {
    const hasKids = artHasSubarts(r.id);
    const t = hasKids ? 0 : artTotal(r);
    const bg = C.artBg, fg = C.artFg;
    if (isBPU) {
      const bD = r.bpu_desig!==undefined?r.bpu_desig:r.desig;
      const bP = r.bpu_pu!==undefined?r.bpu_pu:r.pu;
      const bU = r.bpu_unite!==undefined?r.bpu_unite:r.unite;
      const sl = !hasKids ? buildBpuSubline(bU, num(bP)) : '';
      return `<tr>
        <td style="${CELL}background:${bg};color:${fg};text-align:center;">${esc(n)}</td>
        <td style="${CELL}background:${bg};color:${fg};">${escNl(bD)}${sl?`<br/><em style="font-size:9pt;font-weight:bold;">${esc(sl)}</em>`:''}</td>
        <td style="${NCELL}background:${bg};color:${fg};">${!hasKids&&!hide?daNoUnit(num(bP)):''}</td>
      </tr>`;
    }
    return `<tr>
      <td style="${CELL}background:${bg};color:${fg};text-align:center;">${esc(n)}</td>
      <td style="${CELL}background:${bg};color:${fg};">${escNl(r.desig||'')}</td>
      <td style="${CELL}background:${bg};color:${fg};text-align:center;">${hasKids?'':esc(r.unite||'')}</td>
      <td style="${NCELL}background:${bg};color:${fg};">${hasKids?'':fmtNum(r.qty)}</td>
      <td style="${NCELL}background:${bg};color:${fg};">${hasKids||hide?'':daNoUnit(num(r.pu))}</td>
      <td style="${NCELL}background:${bg};color:${fg};">${t&&!hide?daNoUnit(t):''}</td>
    </tr>`;
  };

  const subartRow = (r, letter) => {
    const t = artTotal(r);
    const bg = C.saBg, fg = C.saFg;
    // N° cell is always empty — letter goes inside the designation cell as bold prefix
    const letterSpan = `<strong style="white-space:nowrap;padding-right:4px;">${esc(letter)}</strong>`;
    if (isBPU) {
      const bD = r.bpu_desig!==undefined?r.bpu_desig:r.desig;
      const bP = r.bpu_pu!==undefined?r.bpu_pu:r.pu;
      const bU = r.bpu_unite!==undefined?r.bpu_unite:r.unite;
      const sl = buildBpuSubline(bU, num(bP));
      return `<tr>
        <td style="${CELL}background:${bg};color:${fg};"></td>
        <td style="${CELL}background:${bg};color:${fg};">${letterSpan}${escNl(bD)}${sl?`<br/><em style="font-size:9pt;font-weight:bold;">${esc(sl)}</em>`:''}</td>
        <td style="${NCELL}background:${bg};color:${fg};">${!hide?daNoUnit(num(bP)):''}</td>
      </tr>`;
    }
    return `<tr>
      <td style="${CELL}background:${bg};color:${fg};"></td>
      <td style="${CELL}background:${bg};color:${fg};">${letterSpan}${escNl(r.desig||'')}</td>
      <td style="${CELL}background:${bg};color:${fg};text-align:center;">${esc(r.unite||'')}</td>
      <td style="${NCELL}background:${bg};color:${fg};">${fmtNum(r.qty)}</td>
      <td style="${NCELL}background:${bg};color:${fg};">${!hide?daNoUnit(num(r.pu)):''}</td>
      <td style="${NCELL}background:${bg};color:${fg};">${t&&!hide?daNoUnit(t):''}</td>
    </tr>`;
  };

  const blankRow = (r) => {
    const span = isBPU ? 3 : 6;
    return `<tr><td colspan="${span}" style="${CELL}font-style:italic;">${escNl(r.desig||'')}</td></tr>`;
  };

  const subTotRow = (desig, total) => {
    const span = isBPU ? 2 : 5;
    return `<tr>
      <td colspan="${span}" style="${NCELL}background:${C.tsBg};color:${C.tsFg};text-align:right;text-transform:uppercase;">Total ${esc(desig)}</td>
      <td style="${NCELL}background:${C.tsBg};color:${C.tsFg};">${!hide?daNoUnit(total):''}</td>
    </tr>`;
  };

  const chapTotRow = (desig, total) => {
    const span = isBPU ? 2 : 5;
    return `<tr>
      <td colspan="${span}" style="${NCELL}background:${C.tcBg};color:${C.tcFg};text-align:right;font-size:11pt;text-transform:uppercase;">Total ${esc(desig)}</td>
      <td style="${NCELL}background:${C.tcBg};color:${C.tcFg};font-size:11pt;">${!hide?daNoUnit(total):''}</td>
    </tr>`;
  };

  // Build all rows
  let tableRows = '';
  let chapStk=[], subStk=[];

  // Only flush totals in DQE — BPU has no sub/chap total rows
  const flushSubs = () => {
    if (isBPU) { subStk = []; return; }
    while (subStk.length) { const s=subStk.pop(); tableRows+=subTotRow(s.desig,subT[s.id]||0); }
  };
  const flushChap = () => {
    if (isBPU || !chapStk.length) { chapStk=[]; return; }
    const c=chapStk.pop(); tableRows+=chapTotRow(c.desig,chapT[c.id]||0);
  };

  rows.forEach((r,i) => {
    const n=nums[i], letter=letters[i];
    if(r.type==='chap')         { flushSubs();flushChap();chapStk.push({id:r.id,desig:r.desig});tableRows+=chapRow(r); }
    else if(r.type==='sub')     { const lv=r.level||1;if(!isBPU){while(subStk.length&&subStk[subStk.length-1].level>=lv){const s=subStk.pop();tableRows+=subTotRow(s.desig,subT[s.id]||0);}}else{while(subStk.length&&subStk[subStk.length-1].level>=lv)subStk.pop();}subStk.push({id:r.id,desig:r.desig,level:lv});tableRows+=subRow(r,n); }
    else if(r.type==='art')     { tableRows+=artRow(r,n); }
    else if(r.type==='subart')  { tableRows+=subartRow(r,letter); }
    else if(r.type==='blank')   { tableRows+=blankRow(r); }
  });
  flushSubs(); flushChap();

  // Grand total rows (DQE only)
  const span5 = isBPU ? 2 : 5;
  if (!isBPU) {
    tableRows += `
    <tr><td colspan="${span5}" style="${NCELL}background:${C.gtBg};color:${C.gtFg};font-size:12pt;text-transform:uppercase;border-top:3px solid #000;">TOTAL GÉNÉRAL HT</td>
        <td style="${NCELL}background:${C.gtBg};color:${C.gtFg};font-size:12pt;border-top:3px solid #000;">${!hide?daNoUnit(grand):''}</td></tr>
    <tr><td colspan="${span5}" style="${NCELL}background:${C.gtBg};color:${C.gtFg};">TVA (${tvaVal}%)</td>
        <td style="${NCELL}background:${C.gtBg};color:${C.gtFg};">${!hide?daNoUnit(tvaAmt):''}</td></tr>
    <tr><td colspan="${span5}" style="${NCELL}background:${C.gtBg};color:${C.gtFg};font-size:12pt;text-transform:uppercase;border-top:2px solid #000;">TOTAL TTC</td>
        <td style="${NCELL}background:${C.gtBg};color:${C.gtFg};font-size:12pt;border-top:2px solid #000;">${!hide?da(ttcVal):''}</td></tr>`;
  }

  // Column headers — always render price headers to preserve column widths.
  // When prices are hidden, make price header text transparent (column stays same width).
  const priceColor = hide ? 'color:transparent;' : '';
  const thead = isBPU
    ? `<tr style="background:#d9d9d9;">
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;width:55px;">N°</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;">DESIGNATION DES OUVRAGES</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;width:120px;${priceColor}">PRIX UNITAIRE HT</th>
      </tr>`
    : `<tr style="background:#d9d9d9;">
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;width:55px;">N°</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;">DESIGNATION DES OUVRAGES</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:center;width:38px;">U</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:right;width:90px;">QTÉ</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:right;width:90px;${priceColor}">P.U EN HT</th>
        <th style="${CELL}font-weight:bold;text-transform:uppercase;text-align:right;width:108px;">MONTANT HT</th>
      </tr>`;

  // TTC summary lines
  const ttcLetters = !isBPU && ttcVal
    ? numToWordsFr(Math.floor(ttcVal)) + (Math.round((ttcVal - Math.floor(ttcVal)) * 100) > 0 ? ' ET ' + numToWordsFr(Math.round((ttcVal - Math.floor(ttcVal)) * 100)) + ' CENTIMES' : '') + ' DINARS ALGÉRIENS'
    : '';

  // Always show the summary lines in DQE — titles visible always, values transparent when hide=true
  const ttcSummary = !isBPU ? `
  <div style="margin-top:20px;font-family:${F};font-size:11pt;color:#000;line-height:2.4;border-top:2px solid #000;padding-top:12px;">
    <div>Le montant total TTC en chiffres&nbsp;: <strong style="color:${hide?'transparent':'inherit'}">${da(ttcVal)}</strong></div>
    <div>Le montant total TTC en lettres&nbsp;: <strong style="color:${hide?'transparent':'inherit'}"><em>${ttcLetters}</em></strong></div>
  </div>` : '';

  // Header / footer
  const hdrHtml = (p.header||p.showDate) ? `
  <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid #000;margin-bottom:10px;font-family:${F};font-size:10pt;">
    <span>${esc(p.header||projName)}</span><span>${p.showDate?dateStr:''}</span>
  </div>` : '';

  const ftrHtml = (p.footer||p.showPageNum) ? `
  <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid #ccc;margin-top:14px;font-family:${F};font-size:10pt;">
    <span>${esc(p.footer||'')}</span>${p.showPageNum?'<span>Page 1</span>':''}
  </div>` : '';

  // Assemble
  const titleLines = headerLines.map(l => {
    if (!l.text) return '';
    return l.style === 't1'
      ? `<div style="font-family:${F};font-size:12pt;font-weight:bold;text-transform:uppercase;text-decoration:underline;text-align:center;line-height:1.7;">${escNl(l.text)}</div>`
      : `<div style="font-family:${F};font-size:11pt;font-weight:bold;text-transform:uppercase;text-align:center;line-height:1.6;">${escNl(l.text)}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>${esc(projName)}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
@page {
  size: ${pageSize};
  margin: ${p.mt}mm ${p.mr}mm ${p.mb}mm ${p.ml}mm;
}
* { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; color-adjust:exact!important; }
body { font-family:${F}; font-size:11pt; background:#fff; color:#000; }
table { width:100%; border-collapse:collapse; }
th,td { border:1px solid #000; }
.doc-titles { text-align:center; margin-bottom:12px; }
.t1 { font-size:12pt; font-weight:bold; text-transform:uppercase; text-decoration:underline; line-height:1.7; }
.t2 { font-size:11pt; font-weight:bold; text-transform:uppercase; line-height:1.6; }
.band { border:2px solid #000; padding:5px; text-align:center; font-weight:bold; font-size:12pt; text-transform:uppercase; margin-bottom:10px; }
thead { display:table-header-group; }
tr { page-break-inside:avoid; }
</style>
</head>
<body>
${hdrHtml}
<div style="text-align:center;margin-bottom:12px;">${titleLines}</div>
<div class="band">${isBPU?'BORDEREAU DES PRIX UNITAIRES':'DETAIL QUANTITATIF ESTIMATIF'}</div>
<table>
  <thead>${thead}</thead>
  <tbody>${tableRows}</tbody>
</table>
${ttcSummary}
${ftrHtml}
</body>
</html>`;
}

/* ════════════════════════════════════════
   PRINT — opens in default browser
════════════════════════════════════════ */
async function doPrint() {
  const html = buildPrintHTML();
  if (isElectron) {
    notif('🖨 Ouverture dans le navigateur…');
    await window.electronAPI.printInBrowser(html);
    notif('✓ Utilisez Ctrl+P dans le navigateur pour imprimer');
  } else {
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  }
}

/* ════════════════════════════════════════
   PDF — hidden window printToPDF
════════════════════════════════════════ */
async function doExportPdf() {
  const html    = buildPrintHTML();
  const data    = getSaveData();
  const defName = (data.l1||'devis').replace(/\s+/g,'_').substring(0,40)+'.pdf';
  if (isElectron) {
    notif('⏳ Génération du PDF…');
    const p = await window.electronAPI.exportPdf(html, defName);
    if (p) notif('✓ PDF exporté');
    else   notif('⚠ PDF annulé');
  } else {
    window.print();
  }
}

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
  window.electronAPI.onMenuExportPdf(()   => doExportPdf());
  window.electronAPI.onMenuPrint(()       => doPrint());
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
