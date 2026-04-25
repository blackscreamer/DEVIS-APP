/**
 * totals.js — Calcul et mise à jour de tous les totaux.
 *
 * RÈGLE CRITIQUE :
 *   Seuls les rows de type 'art' sont additionnés dans computeTotals() et grandTotal().
 *   Les 'subart' ne sont JAMAIS additionnés directement — ils passent par artParentTotal().
 */

/** Vrai si l'article id est immédiatement suivi de sous-articles */
function artHasSubarts(id) {
  const idx = rows.findIndex(r => r.id === id);
  if (idx < 0) return false;
  for (let i = idx + 1; i < rows.length; i++) {
    if (rows[i].type === 'blank') continue;
    return rows[i].type === 'subart';
  }
  return false;
}

/** Somme des sous-articles enfants d'un article */
function artParentTotal(r) {
  const idx = rows.findIndex(x => x.id === r.id);
  let total = 0;
  for (let i = idx + 1; i < rows.length; i++) {
    if (rows[i].type === 'blank') continue;
    if (rows[i].type !== 'subart') break;
    total += artTotal(rows[i]);
  }
  return total;
}

/** Montant d'un art ou subart pour le mode courant */
function artTotal(r) {
  if (r.type !== 'art' && r.type !== 'subart') return 0;
  if (mode === 'BPU') {
    return num(r.bpu_pu !== undefined ? r.bpu_pu : r.pu);
  }
  return num(r.qty) * num(r.pu);
}

/**
 * Calcule les totaux par sous-chapitre et par chapitre.
 * @returns {{ chapT: Object, subT: Object }}
 */
function computeTotals() {
  const chapT = {}, subT = {};
  let ci = null, subStack = [];

  rows.forEach(r => {
    if (r.type === 'chap') {
      ci = r.id; chapT[ci] = 0; subStack = [];
    } else if (r.type === 'sub') {
      subStack = subStack.filter(s => s.level < (r.level || 1));
      subStack.push({ id: r.id, level: r.level || 1 });
      subT[r.id] = 0;
    } else if (r.type === 'art') {
      const t = artHasSubarts(r.id) ? artParentTotal(r) : artTotal(r);
      if (ci) chapT[ci] = (chapT[ci] || 0) + t;
      subStack.forEach(s => { subT[s.id] = (subT[s.id] || 0) + t; });
    }
    // subart : jamais additionné directement
  });

  return { chapT, subT };
}

/** Total général — somme de tous les articles */
function grandTotal() {
  return rows.reduce((s, r) => {
    if (r.type === 'art') return s + (artHasSubarts(r.id) ? artParentTotal(r) : artTotal(r));
    return s;
  }, 0);
}

/** Met à jour toutes les cellules totaux sans re-render */
function recalc() {
  const { chapT, subT } = computeTotals();
  const isBPU = mode === 'BPU';

  if (!isBPU) {
    rows.filter(r => r.type === 'art' || r.type === 'subart').forEach(r => {
      const el = document.getElementById('at-' + r.id);
      if (!el) return;

      const t = (r.type === 'art' && artHasSubarts(r.id)) ? 0 : artTotal(r);

      el.textContent = t ? daNoUnit(t) : '';
      el.className = 'tc price-cell' + (t ? ' v' : '');
      el.classList.toggle('hidden-price', !showPrices);
    });

    Object.entries(subT).forEach(([id, t]) => {
      const el = document.getElementById('st-' + id);
      if (!el) return;
      el.textContent = daNoUnit(t);
      el.classList.add('price-cell');
      el.classList.toggle('hidden-price', !showPrices);
    });

    Object.entries(chapT).forEach(([id, t]) => {
      const el = document.getElementById('ct-' + id);
      if (!el) return;
      el.textContent = daNoUnit(t);
      el.classList.add('price-cell');
      el.classList.toggle('hidden-price', !showPrices);
    });

    const grand    = grandTotal();
    const tvaPct   = num(document.getElementById('tva').value) / 100;
    const tvaAmt   = grand * tvaPct;

    const elGt  = document.getElementById('gt-val');
    const elTva = document.getElementById('tva-val');
    const elTtc = document.getElementById('ttc-val');

    if (elGt)  elGt.textContent  = da(grand);
    if (elTva) elTva.textContent = da(tvaAmt);
    if (elTtc) elTtc.textContent = da(grand + tvaAmt);

    [elGt, elTva, elTtc].forEach(el => {
      if (!el) return;
      el.classList.add('price-cell');
      el.classList.toggle('hidden-price', !showPrices);
    });

    document.getElementById('fht').textContent  = da(grand);
    document.getElementById('ftva').textContent = da(tvaAmt);
    document.getElementById('fttc').textContent = da(grand + tvaAmt);

  } else {
    rows.filter(r => r.type === 'art' || r.type === 'subart').forEach(r => {
      const sl = document.getElementById('sl-' + r.id);
      if (sl) {
        if (r.type === 'art' && artHasSubarts(r.id)) {
          sl.textContent = '';
          return;
        }
        const bPu    = r.bpu_pu    !== undefined ? r.bpu_pu    : r.pu;
        const bUnite = r.bpu_unite !== undefined ? r.bpu_unite : r.unite;
        sl.textContent = buildBpuSubline(bUnite, num(bPu));
      }
    });

    document.getElementById('fht').textContent  = '—';
    document.getElementById('ftva').textContent = '—';
    document.getElementById('fttc').textContent = '—';
  }

  document.getElementById('fpct').textContent = document.getElementById('tva').value;
  document.getElementById('fcnt').textContent = rows.filter(r => r.type === 'art').length;

  adjustColumns();
}

  /* ── TTC summary lines below the table ── */
  const summaryDiv = document.getElementById('ttc-summary');
  if (summaryDiv) {
    if (isBPU) {
      summaryDiv.style.display = 'none';
    } else {
      summaryDiv.style.display = '';
      const grand   = grandTotal();
      const tvaPct  = num(document.getElementById('tva').value) / 100;
      const ttcVal  = grand + grand * tvaPct;
      const elChif  = document.getElementById('ttc-chiffres');
      const elLett  = document.getElementById('ttc-lettres');
      if (elChif) elChif.textContent = ttcVal ? da(ttcVal) : '—';
      if (elLett) {
        if (ttcVal) {
          const intPart = Math.floor(ttcVal);
          const dec     = Math.round((ttcVal - intPart) * 100);
          let txt = numToWordsFr(intPart) + ' DINAR' + (intPart > 1 ? 'S' : '') + ' ALGÉRIEN' + (intPart > 1 ? 'S' : '');
          if (dec > 0) txt += ' ET ' + numToWordsFr(dec) + ' CENTIME' + (dec > 1 ? 'S' : '');
          elLett.textContent = txt;
        } else {
          elLett.textContent = '—';
        }
      }
    }
  }

/**
 * Ajuste la largeur de la colonne Montant HT selon la valeur la plus large.
 * Avec table-layout:auto le navigateur gère les autres colonnes automatiquement.
 */
function adjustColumns() {
  const ctCol = document.querySelector('col.ct');
  if (!ctCol) return;
  const fTot = document.getElementById('fttc');
  if (!fTot) return;
  const span = document.createElement('span');
  span.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:"Times New Roman",Times,serif;font-weight:bold;font-size:12pt;padding:0 12px';
  span.textContent = fTot.textContent;
  document.body.appendChild(span);
  const w = Math.max(span.offsetWidth + 4, 100);
  document.body.removeChild(span);
  ctCol.style.width = w + 'px';
  const cpCol = document.querySelector('col.cp');
  if (cpCol) cpCol.style.width = Math.max(w - 10, 90) + 'px';
}
