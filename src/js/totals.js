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
    // En BPU, utilise bpu_pu si défini, sinon pu
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
    // Montant HT des articles
    rows.filter(r => r.type === 'art' || r.type === 'subart').forEach(r => {
      const el = document.getElementById('at-' + r.id);
      if (!el) return;
      const t = (r.type === 'art' && artHasSubarts(r.id)) ? 0 : artTotal(r);
      el.textContent = t ? daNoUnit(t) : '';
      el.className = 'tc' + (t ? ' v' : '') + ' price-cell';
    });
    // Totaux sous-chap / chap (sans DA)
    Object.entries(subT).forEach(([id, t]) => { const el = document.getElementById('st-' + id); if (el) el.textContent = daNoUnit(t); });
    Object.entries(chapT).forEach(([id, t]) => { const el = document.getElementById('ct-' + id); if (el) el.textContent = daNoUnit(t); });

    // Totaux finaux (avec DA)
    const grand    = grandTotal();
    const tvaPct   = num(document.getElementById('tva').value) / 100;
    const tvaAmt   = grand * tvaPct;
    const elGt     = document.getElementById('gt-val');   if (elGt)  elGt.textContent  = da(grand);
    const elTva    = document.getElementById('tva-val');  if (elTva) elTva.textContent  = da(tvaAmt);
    const elTtc    = document.getElementById('ttc-val');  if (elTtc) elTtc.textContent  = da(grand + tvaAmt);
    const elTvaLbl = document.getElementById('tva-label');if (elTvaLbl) elTvaLbl.textContent = 'TVA (' + document.getElementById('tva').value + '%)';
    document.getElementById('fht').textContent  = da(grand);
    document.getElementById('ftva').textContent = da(tvaAmt);
    document.getElementById('fttc').textContent = da(grand + tvaAmt);
  } else {
    // BPU : mise à jour des sublines prix en lettres
    rows.filter(r => r.type === 'art' || r.type === 'subart').forEach(r => {
      const sl = document.getElementById('sl-' + r.id);
      if (sl) {
        const bPu    = r.bpu_pu    !== undefined ? r.bpu_pu    : r.pu;
        const bUnite = r.bpu_unite !== undefined ? r.bpu_unite : r.unite;
        // Pas de subline sur article parent (hasKids)
        if (r.type === 'art' && artHasSubarts(r.id)) { sl.textContent = ''; return; }
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

/** Ajuste dynamiquement la largeur de la colonne Montant HT */
function adjustColumns() {
  const cols = {
    pu:  document.querySelector('col.cp'),
    tot: document.querySelector('col.ct'),
    qty: document.querySelector('col.cq'),
  };
  const fTot = document.getElementById('fttc');
  const span = document.createElement('span');
  span.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:"Times New Roman",Times,serif;font-weight:bold;font-size:12pt;padding:0 10px';
  document.body.appendChild(span);
  span.textContent = fTot.textContent;
  let maxW = Math.max(span.offsetWidth + 10, 75);
  document.body.removeChild(span);
  if (cols.pu)  cols.pu.style.width  = '92px';
  if (cols.tot) cols.tot.style.width = maxW + 'px';
  if (cols.qty) cols.qty.style.width = '82px';
}
