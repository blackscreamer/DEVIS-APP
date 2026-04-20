/**
 * export.js — Export Excel avec mise en forme identique à l'application.
 *
 * Nécessite la version Pro de SheetJS (xlsx-style ou exceljs) pour les styles.
 * Ici on utilise exceljs qui est gratuit et supporte les styles complets.
 * Installation: npm install exceljs
 *
 * Couleurs de cellules, gras, bordures, hauteurs de lignes —
 * tout correspond aux couleurs de l'objet C (palette de l'app).
 */

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: convertit une couleur CSS hex (#rrggbb) en ARGB Excel (FFRRGGBB)
───────────────────────────────────────────────────────────────────────── */
function hexToArgb(hex) {
  const h = hex.replace('#', '');
  return 'FF' + (h.length === 3
    ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
    : h).toUpperCase();
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: retourne un objet de remplissage solide ExcelJS
───────────────────────────────────────────────────────────────────────── */
function fill(hex) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(hex) } };
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: bordure fine noire sur tous les côtés
───────────────────────────────────────────────────────────────────────── */
const BORDER_THIN = {
  top:    { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  left:   { style: 'thin', color: { argb: 'FF000000' } },
  right:  { style: 'thin', color: { argb: 'FF000000' } },
};

const BORDER_MED_TOP = {
  ...BORDER_THIN,
  top: { style: 'medium', color: { argb: 'FF000000' } },
};

const FONT_BASE = { name: 'Times New Roman', size: 11 };

/* ─────────────────────────────────────────────────────────────────────────
   MAIN EXPORT FUNCTION
───────────────────────────────────────────────────────────────────────── */
async function doExport() {
  if (!rows.length) { notif('⚠ Aucune donnée'); return; }

  // ExcelJS is loaded via CDN in index.html or require'd here
  // We use window.ExcelJS if available (CDN), otherwise require
  const ExcelJS = window.ExcelJS || (typeof require !== 'undefined' ? require('exceljs/dist/exceljs.min.js') : null);

  if (!ExcelJS) {
    // Fallback: plain XLSX without styles
    notif('⚠ ExcelJS non disponible — export basique');
    return doExportBasic();
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Devis BTP';
  wb.created = new Date();

  const { nums, letters } = buildNums();
  const { chapT, subT }   = computeTotals();
  const isBPU             = mode === 'BPU';
  const projName          = (headerLines[0]?.text) || 'Devis BTP';
  const tvaV              = num(document.getElementById('tva').value);

  const ws = wb.addWorksheet(isBPU ? 'BPU' : 'DQE');

  /* ── Column widths ── */
  if (isBPU) {
    ws.columns = [
      { width: 10 },   // N°
      { width: 70 },   // Désignation
      { width: 20 },   // Prix U
    ];
  } else {
    ws.columns = [
      { width: 10 },   // N°
      { width: 55 },   // Désignation
      { width: 7  },   // U
      { width: 12 },   // Qté
      { width: 16 },   // Prix U HT
      { width: 18 },   // Montant HT
    ];
  }

  const COLS = isBPU ? 3 : 6;

  /* ── HEADER: project titles ── */
  const addHeader = (text, bold, size) => {
    const r = ws.addRow([text]);
    r.height = 20;
    const cell = r.getCell(1);
    ws.mergeCells(r.number, 1, r.number, COLS);
    cell.value = text;
    cell.font  = { name: 'Times New Roman', size: size || 12, bold: !!bold, underline: bold };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  };

  // All header lines (unlimited)
  headerLines.forEach((line, i) => {
    if (line.text) addHeader(line.text, i === 0, i === 0 ? 13 : 11);
  });

  // Band row
  const bandRow = ws.addRow(['']);
  ws.mergeCells(bandRow.number, 1, bandRow.number, COLS);
  const bandCell = bandRow.getCell(1);
  bandCell.value = isBPU ? 'BORDEREAU DES PRIX UNITAIRES' : 'DETAIL QUANTITATIF ESTIMATIF';
  bandCell.font  = { name: 'Times New Roman', size: 12, bold: true };
  bandCell.alignment = { horizontal: 'center', vertical: 'middle' };
  bandCell.border = BORDER_THIN;
  bandRow.height = 22;

  ws.addRow([]); // spacer

  /* ── THEAD ── */
  const headData = isBPU
    ? ['N°', 'DESIGNATION DES OUVRAGES', showPrices ? 'PRIX UNITAIRE HT (DA)' : '']
    : ['N°', 'DESIGNATION DES OUVRAGES', 'U', 'QUANTITE', 'PRIX U HT (DA)', 'MONTANT HT (DA)'];

  const headRow = ws.addRow(headData);
  headRow.height = 28;
  headRow.eachCell((cell, col) => {
    cell.fill      = fill('#d9d9d9');
    cell.font      = { name: 'Times New Roman', size: 10, bold: true };
    cell.border    = BORDER_THIN;
    cell.alignment = { horizontal: col <= 2 ? 'center' : 'right', vertical: 'middle', wrapText: true };
  });

  /* ── ROWS ── */
  let chapStk = [], subStk = [];

  const addTotalRow = (label, value, bgHex, fgHex, isBold, topBorder) => {
    const data = isBPU
      ? [null, label, showPrices ? value : null]
      : [null, label, null, null, null, showPrices ? value : null];
    const r = ws.addRow(data);
    r.height = 18;
    ws.mergeCells(r.number, 1, r.number, isBPU ? 2 : 5);
    r.eachCell((cell, col) => {
      cell.fill   = fill(bgHex);
      cell.font   = { name: 'Times New Roman', size: 11, bold: !!isBold, color: { argb: hexToArgb(fgHex) } };
      cell.border = topBorder ? BORDER_MED_TOP : BORDER_THIN;
      cell.alignment = { horizontal: col === (isBPU ? 2 : 5) || col === COLS ? 'right' : 'left', vertical: 'middle' };
    });
    // Value cell
    const valCell = r.getCell(COLS);
    valCell.numFmt = '#,##0.00';
    valCell.alignment = { horizontal: 'right', vertical: 'middle' };
    return r;
  };

  const pushSubTotals = () => {
    if (isBPU) { subStk = []; return; }
    while (subStk.length) {
      const s = subStk.pop();
      addTotalRow('Total ' + s.desig, subT[s.id] || 0, C.tsBg, C.tsFg, true, true);
    }
  };
  const pushChapTotal = () => {
    if (isBPU) { chapStk = []; return; }
    if (!chapStk.length) return;
    const c = chapStk.pop();
    addTotalRow('Total ' + c.desig, chapT[c.id] || 0, C.tcBg, C.tcFg, true, true);
  };

  rows.forEach((r, i) => {
    const n      = nums[i];
    const letter = letters[i];

    /* ─ CHAPITRE ─ */
    if (r.type === 'chap') {
      pushSubTotals(); pushChapTotal();
      chapStk.push({ id: r.id, desig: r.desig });
      const data = isBPU ? [n, r.desig, null] : [n, r.desig, null, null, null, null];
      const row  = ws.addRow(data);
      row.height = 20;
      ws.mergeCells(row.number, 2, row.number, COLS);
      row.eachCell(cell => {
        cell.fill   = fill(C.chapBg);
        cell.font   = { name: 'Times New Roman', size: 12, bold: true, color: { argb: hexToArgb(C.chapFg) } };
        cell.border = BORDER_THIN;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    /* ─ SOUS-CHAPITRE ─ */
    else if (r.type === 'sub') {
      const lv = r.level || 1;
      if (!isBPU) {
        while (subStk.length && subStk[subStk.length-1].level >= lv) {
          const s = subStk.pop();
          addTotalRow('Total ' + s.desig, subT[s.id] || 0, C.tsBg, C.tsFg, true, true);
        }
      } else {
        while (subStk.length && subStk[subStk.length-1].level >= lv) subStk.pop();
      }
      subStk.push({ id: r.id, desig: r.desig, level: lv });
      const bg  = lv===1 ? C.sub1Bg : lv===2 ? C.sub2Bg : C.sub3Bg;
      const fg  = lv===1 ? C.sub1Fg : lv===2 ? C.sub2Fg : C.sub3Fg;
      const data = isBPU ? [n, r.desig, null] : [n, r.desig, null, null, null, null];
      const row  = ws.addRow(data);
      row.height = 18;
      ws.mergeCells(row.number, 2, row.number, COLS);
      row.eachCell(cell => {
        cell.fill   = fill(bg);
        cell.font   = { name: 'Times New Roman', size: 11, bold: true, color: { argb: hexToArgb(fg) } };
        cell.border = BORDER_THIN;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    /* ─ ARTICLE ─ */
    else if (r.type === 'art') {
      const hasKids = artHasSubarts(r.id);
      const t       = hasKids ? artParentTotal(r) : artTotal(r);
      const bDesig  = r.bpu_desig !== undefined ? r.bpu_desig : r.desig;
      const bPu     = r.bpu_pu   !== undefined ? r.bpu_pu   : r.pu;
      const bUnite  = r.bpu_unite!== undefined ? r.bpu_unite: r.unite;

      let data;
      if (isBPU) {
        // Full price-in-letters subline (unit + amount in words)
        const subline = !hasKids ? buildBpuSubline(bUnite, num(bPu)) : '';
        data = [n, bDesig + (subline ? '\n' + subline : ''), showPrices && !hasKids ? num(bPu) : null];
      } else {
        data = [n, r.desig, hasKids?'':r.unite, hasKids?'':num(r.qty)||'', showPrices&&!hasKids ? num(r.pu)||'' : '', showPrices&&!hasKids ? t||'' : ''];
      }
      const row = ws.addRow(data);
      row.height = isBPU && !hasKids ? 28 : 16; // taller for BPU rows with subline
      row.eachCell((cell, col) => {
        cell.fill   = fill(C.artBg);
        cell.font   = { name: 'Times New Roman', size: 11, color: { argb: hexToArgb(C.artFg) } };
        cell.border = BORDER_THIN;
        cell.alignment = { horizontal: col >= (isBPU ? 3 : 4) ? 'right' : 'left', vertical: 'middle', wrapText: true };
        if (col >= (isBPU ? 3 : 4)) { cell.numFmt = '#,##0.00'; cell.font = { ...cell.font, bold: true }; }
      });
    }

    /* ─ SOUS-ARTICLE ─ */
    else if (r.type === 'subart') {
      const t      = artTotal(r);
      const bDesig = r.bpu_desig !== undefined ? r.bpu_desig : r.desig;
      const bPu    = r.bpu_pu   !== undefined ? r.bpu_pu   : r.pu;
      const bUnite = r.bpu_unite!== undefined ? r.bpu_unite: r.unite;

      let data;
      if (isBPU) {
        const subline = buildBpuSubline(bUnite, num(bPu));
        data = [letter, bDesig + (subline ? '\n' + subline : ''), showPrices ? num(bPu) : null];
      } else {
        data = [letter, r.desig, r.unite, num(r.qty)||'', showPrices ? num(r.pu)||'' : '', showPrices ? t||'' : ''];
      }
      const row = ws.addRow(data);
      row.height = isBPU ? 28 : 16;
      row.eachCell((cell, col) => {
        cell.fill   = fill(C.saBg);
        cell.font   = { name: 'Times New Roman', size: 11, color: { argb: hexToArgb(C.saFg) } };
        cell.border = BORDER_THIN;
        cell.alignment = { horizontal: col >= (isBPU ? 3 : 4) ? 'right' : 'left', vertical: 'middle', wrapText: true };
        if (col >= (isBPU ? 3 : 4)) { cell.numFmt = '#,##0.00'; cell.font = { ...cell.font, bold: true }; }
      });
    }

    /* ─ LIGNE VIDE ─ */
    else if (r.type === 'blank') {
      const data = isBPU ? ['', r.desig, ''] : ['', r.desig, '', '', '', ''];
      const row  = ws.addRow(data);
      row.height = 14;
      row.eachCell(cell => {
        cell.font   = { name: 'Times New Roman', size: 11, italic: true };
        cell.border = BORDER_THIN;
      });
    }
  });

  /* ── Close remaining groups ── */
  pushSubTotals();
  pushChapTotal();

  /* ── Grand Total / TVA / TTC (DQE only) ── */
  if (!isBPU && showPrices) {
    const grand  = grandTotal();
    const tvaAmt = grand * tvaV / 100;
    addTotalRow('TOTAL GÉNÉRAL HT', grand, C.gtBg, C.gtFg, true, true);
    addTotalRow(`TVA (${tvaV}%)`, tvaAmt, C.gtBg, C.gtFg, true, false);
    addTotalRow('TOTAL TTC', grand + tvaAmt, C.gtBg, C.gtFg, true, true);
  }

  /* ── Freeze header rows ── */
  const frozenRows = headerLines.filter(l => l.text).length + 2 + 1; // titles + band + spacer + thead
  ws.views = [{ state: 'frozen', ySplit: frozenRows, xSplit: 0 }];

  /* ── Generate buffer and save ── */
  const defName = projName.replace(/\s+/g,'_').substring(0,40) + '_' + mode + (showPrices?'':'_sans-prix') + '.xlsx';

  const buffer = await wb.xlsx.writeBuffer();

  if (isElectron) {
    const savedPath = await window.electronAPI.saveExcel(Array.from(new Uint8Array(buffer)), defName);
    if (savedPath) notif('✓ Excel exporté avec mise en forme');
  } else {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = defName; a.click();
    notif('✓ Excel téléchargé');
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   FALLBACK: basic XLSX without styling (uses SheetJS already loaded)
───────────────────────────────────────────────────────────────────────── */
async function doExportBasic() {
  if (!rows.length) { notif('⚠ Aucune donnée'); return; }
  const wb = XLSX.utils.book_new();
  const { nums, letters } = buildNums();
  const { chapT, subT }   = computeTotals();
  const isBPU = mode === 'BPU';
  const projName = (headerLines[0]?.text) || 'Devis BTP';
  const data = [];

  // All header lines
  headerLines.forEach(l => data.push([l.text || '']));
  data.push([]);
  data.push([isBPU ? 'BORDEREAU DES PRIX UNITAIRES' : 'DETAIL QUANTITATIF ESTIMATIF']);
  data.push([]);

  const hdr = isBPU
    ? ['N°','DESIGNATION DES OUVRAGES', showPrices?'PRIX U HT':'']
    : ['N°','DESIGNATION','U','QTE','PRIX U HT','MONTANT HT'];
  data.push(hdr);

  let cStk=[], sStk=[];
  const pst=()=>{ if(isBPU){sStk=[];return;} while(sStk.length){const s=sStk.pop();data.push(['','Total '+s.desig,'','','',showPrices?subT[s.id]||0:'']);} };
  const pct=()=>{ if(isBPU||!cStk.length)return;const c=cStk.pop();data.push(['','Total '+c.desig,'','','',showPrices?chapT[c.id]||0:'']); };

  rows.forEach((r,i)=>{
    const n=nums[i], l=letters[i];
    if(r.type==='chap')   {pst();pct();cStk.push({id:r.id,desig:r.desig});data.push([n,r.desig,'','','','']);}
    else if(r.type==='sub'){const lv=r.level||1;if(!isBPU){while(sStk.length&&sStk[sStk.length-1].level>=lv){const s=sStk.pop();data.push(['','Total '+s.desig,'','','',showPrices?subT[s.id]||0:'']);}}else{while(sStk.length&&sStk[sStk.length-1].level>=lv)sStk.pop();}sStk.push({id:r.id,desig:r.desig,level:lv});data.push([n,r.desig,'','','','']);}
    else if(r.type==='art'){const hasKids=artHasSubarts(r.id);const t=hasKids?artParentTotal(r):artTotal(r);
      if(isBPU){const bD=r.bpu_desig!==undefined?r.bpu_desig:r.desig;const bP=r.bpu_pu!==undefined?r.bpu_pu:r.pu;const bU=r.bpu_unite!==undefined?r.bpu_unite:r.unite;const sl=!hasKids?buildBpuSubline(bU,num(bP)):'';data.push([n,bD+(sl?'\n'+sl:''),showPrices&&!hasKids?num(bP):'']);}
      else{data.push([n,r.desig,hasKids?'':r.unite,hasKids?'':num(r.qty),showPrices&&!hasKids?num(r.pu):'',showPrices?t:'']);}}
    else if(r.type==='subart'){const t=artTotal(r);
      if(isBPU){const bD=r.bpu_desig!==undefined?r.bpu_desig:r.desig;const bP=r.bpu_pu!==undefined?r.bpu_pu:r.pu;const bU=r.bpu_unite!==undefined?r.bpu_unite:r.unite;const sl=buildBpuSubline(bU,num(bP));data.push([l,bD+(sl?'\n'+sl:''),showPrices?num(bP):'']);}
      else{data.push([l,r.desig,r.unite,num(r.qty),showPrices?num(r.pu):'',showPrices?t:'']);}}
    else if(r.type==='blank'){data.push(['',r.desig,'','','','']);}
  });
  pst();pct();
  if(!isBPU&&showPrices){const g=grandTotal();const tv=num(document.getElementById('tva').value)/100;data.push([]);data.push(['','TOTAL HT','','','',g]);data.push(['','TVA','','','',g*tv]);data.push(['','TOTAL TTC','','','',g+g*tv]);}

  const ws=XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=[{wch:10},{wch:55},{wch:7},{wch:10},{wch:14},{wch:16}];
  XLSX.utils.book_append_sheet(wb,ws,mode);

  const defName = projName.replace(/\s+/g,'_').substring(0,40)+'_'+mode+'.xlsx';
  if(isElectron){const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});await window.electronAPI.saveExcel(Array.from(buf),defName);}
  else{XLSX.writeFile(wb,defName);}
  notif('✓ Excel exporté (sans styles)');
}

/* ─────────────────────────────────────────────────────────────────────────
   IMPORT EXCEL
───────────────────────────────────────────────────────────────────────── */
function importExcelFile(inp) {
  const f = inp.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = e => importExcelBuffer(new Uint8Array(e.target.result));
  reader.readAsArrayBuffer(f);
  inp.value = '';
}

function importExcelBuffer(buf) {
  try {
    const workbook = XLSX.read(buf, { type: 'array' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const json     = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    snapshot();
    const newRows = [];
    json.forEach(row => {
      const numStr = String(row[0] || '').trim();
      const desig  = String(row[1] || '').trim();
      if (!numStr && !desig) return;
      let type = 'blank';
      if (ROMAN.includes(numStr))         type = 'chap';
      else if (/^[a-z]\)$/.test(numStr))  type = 'subart';
      else if (/^\d+\.\d+$/.test(numStr)) type = 'art';
      else if (/^\d+-?$/.test(numStr))    type = 'sub';
      const obj = { id: uid(), type, desig, collapsed: false };
      if (type === 'sub') obj.level = 1;
      if (type === 'art' || type === 'subart') {
        obj.unite = row[2] || 'M²';
        obj.qty   = row[3] || '';
        obj.pu    = row[4] || '';
      }
      newRows.push(obj);
    });
    rows = newRows;
    nid  = rows.length + 10;
    render(); triggerAutosave();
    notif('✓ Excel importé — ' + newRows.length + ' lignes');
  } catch (err) {
    console.error(err);
    notif('⚠ Erreur import Excel : ' + err.message);
  }
}
