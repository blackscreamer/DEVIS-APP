/**
 * export.js — Export Excel (XLSX) et import Excel.
 */

/* ── Export Excel ── */
async function doExport() {
  if (!rows.length) { notif('⚠ Aucune donnée'); return; }

  const wb         = XLSX.utils.book_new();
  const { nums, letters } = buildNums();
  const { chapT, subT }   = computeTotals();
  const l1         = document.getElementById('hl1').value;
  const data       = [];

  data.push([l1]);
  data.push([document.getElementById('hl2').value]);
  data.push([document.getElementById('hl3').value]);
  data.push([]);
  data.push([mode === 'DQE' ? 'DETAIL QUANTITATIF ESTIMATIF' : 'BORDEREAU DES PRIX UNITAIRES']);
  data.push([]);

  if (mode === 'BPU') {
    data.push(['N°', 'DESIGNATION DES OUVRAGES', showPrices ? 'PRIX UNITAIRE HT (DA)' : '']);
    rows.forEach((r, i) => {
      const n = nums[i], letter = letters[i];
      const bDesig = r => r.bpu_desig !== undefined ? r.bpu_desig : r.desig;
      const bPu    = r => r.bpu_pu   !== undefined ? r.bpu_pu   : r.pu;
      const bUnite = r => r.bpu_unite!== undefined ? r.bpu_unite: r.unite;
      if (r.type === 'chap') {
        data.push([n, r.desig, showPrices ? '' : '']);
      } else if (r.type === 'sub') {
        data.push([n, r.desig, showPrices ? '' : '']);
      } else if (r.type === 'art') {
        const subline = (UNIT_WORDS[bUnite(r)] || bUnite(r).toUpperCase());
        const fullDesig = bDesig(r) + (bDesig(r) ? '\n' : '') + subline;
        data.push([n, fullDesig, showPrices ? num(bPu(r)) : '']);
      } else if (r.type === 'subart') {
        const subline = (UNIT_WORDS[bUnite(r)] || bUnite(r).toUpperCase());
        const fullDesig = bDesig(r) + (bDesig(r) ? '\n' : '') + subline;
        data.push([letter, fullDesig, showPrices ? num(bPu(r)) : '']);
      } else if (r.type === 'blank') {
        data.push(['', r.desig, '']);
      }
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 10 }, { wch: 70 }, ...(showPrices ? [{ wch: 18 }] : [])];
    XLSX.utils.book_append_sheet(wb, ws, 'BPU');
  } else {
    // DQE
    const hdr = ['N°', 'DESIGNATION DES OUVRAGES', 'U', 'Quantité', 'PRIX U HT (DA)', 'MONTANT HT (DA)'];
    data.push(hdr);

    let chapStk = [], subStk2 = [];
    const pst2 = () => {
      while (subStk2.length) {
        const s = subStk2.pop(); const t = subT[s.id] || 0;
        data.push(['', 'Total ' + s.desig, '', '', '', showPrices ? t : '']);
      }
    };
    const pct2 = () => {
      if (!chapStk.length) return;
      const c = chapStk.pop(); const t = chapT[c.id] || 0;
      data.push(['', 'Total ' + c.desig, '', '', '', showPrices ? t : '']);
    };

    rows.forEach((r, i) => {
      const n = nums[i], letter = letters[i];
      if (r.type === 'chap') {
        pst2(); pct2(); chapStk.push({ id: r.id, desig: r.desig });
        data.push([n, r.desig, '', '', '', '']);
      } else if (r.type === 'sub') {
        const lv = r.level || 1;
        while (subStk2.length && subStk2[subStk2.length-1].level >= lv) {
          const s = subStk2.pop(); data.push(['', 'Total ' + s.desig, '', '', '', showPrices ? subT[s.id]||0 : '']);
        }
        subStk2.push({ id: r.id, desig: r.desig, level: lv });
        data.push([n, r.desig, '', '', '', '']);
      } else if (r.type === 'art') {
        const hasKids = artHasSubarts(r.id);
        const t = hasKids ? artParentTotal(r) : artTotal(r);
        data.push([n, r.desig, hasKids?'':r.unite, hasKids?'':num(r.qty), showPrices?(hasKids?'':num(r.pu)):'', showPrices?t:'']);
      } else if (r.type === 'subart') {
        const t = artTotal(r);
        data.push([letter, r.desig, r.unite, num(r.qty), showPrices?num(r.pu):'', showPrices?t:'']);
      } else if (r.type === 'blank') {
        data.push(['', r.desig, '', '', '', '']);
      }
    });
    pst2(); pct2();

    if (showPrices) {
      const grand = grandTotal();
      const tvaPct = num(document.getElementById('tva').value) / 100;
      const tvaAmt = grand * tvaPct;
      data.push([]);
      data.push(['', 'TOTAL GÉNÉRAL HT', '', '', '', grand]);
      data.push(['', 'TVA ' + document.getElementById('tva').value + '%', '', '', '', tvaAmt]);
      data.push(['', 'TOTAL TTC', '', '', '', grand + tvaAmt]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch:10 },{ wch:55 },{ wch:6 },{ wch:10 },{ wch:14 },{ wch:16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'DQE');
  }

  const defName = (l1 || 'devis').replace(/\s+/g,'_').substring(0,40) + '_' + mode + (showPrices ? '' : '_sans-prix') + '.xlsx';

  if (isElectron) {
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    await window.electronAPI.saveExcel(buffer, defName);
  } else {
    XLSX.writeFile(wb, defName);
  }
  notif('✓ Excel exporté');
}

/* ── Import Excel (via input[type=file] navigateur) ── */
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
      let type = 'blank', level = 1;
      if (ROMAN.includes(numStr))          type = 'chap';
      else if (/^[a-z]$/.test(numStr))     type = 'subart';
      else if (/^\d+\.\d+$/.test(numStr))  type = 'art';
      else if (/^\d+$/.test(numStr))       type = row[2] || row[4] ? 'art' : 'sub';
      const obj = { id: uid(), type, desig, collapsed: false };
      if (type === 'sub') obj.level = level;
      if (type === 'art' || type === 'subart') {
        obj.unite = row[2] || 'M²'; obj.qty = row[3] || ''; obj.pu = row[4] || '';
      }
      newRows.push(obj);
    });
    rows = newRows; nid = rows.length + 10;
    render(); triggerAutosave();
    notif('✓ Excel importé');
  } catch (err) {
    console.error(err); notif('⚠ Erreur import Excel');
  }
}

/* ── Imprimer / PDF ── */
function doPrint() {
  if (isElectron) {
    // Le menu Electron gère l'export PDF via printToPDF
    window.print();
  } else {
    window.print();
  }
}
