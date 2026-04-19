/**
 * prices.js — Toggle affichage des prix + changement de mode DQE/BPU.
 */

/* ── Toggle affichage des prix ── */
function togglePrices() {
  showPrices = !showPrices;
  applyPricesUI();
  triggerAutosave();
}

function applyPricesUI() {
  const btn = document.getElementById('btn-prices');
  if (btn) {
    btn.innerHTML = showPrices
      ? '<i class="bi bi-eye-fill"></i> <span class="d-none d-lg-inline">Prix</span>'
      : '<i class="bi bi-eye-slash-fill"></i> <span class="d-none d-lg-inline">Prix</span>';
    btn.classList.toggle('btn-outline-warning', showPrices);
    btn.classList.toggle('btn-outline-danger',  !showPrices);
  }
  document.getElementById('tbl').classList.toggle('no-prices', !showPrices);
  // En BPU, mettre à jour les sublines (avec/sans prix en lettres)
  if (mode === 'BPU') {
    rows.filter(r => r.type === 'art' || r.type === 'subart').forEach(r => {
      if (r.type === 'art' && artHasSubarts(r.id)) return;
      const sl = document.getElementById('sl-' + r.id);
      if (sl) {
        const bPu    = r.bpu_pu    !== undefined ? r.bpu_pu    : r.pu;
        const bUnite = r.bpu_unite !== undefined ? r.bpu_unite : r.unite;
        sl.textContent = buildBpuSubline(bUnite, num(bPu));
      }
    });
  }
}

/* ── Mode DQE / BPU ── */
function setMode(m) {
  mode = m;
  document.getElementById('bdqe').className = 'mbtn' + (m === 'DQE' ? ' on' : '');
  document.getElementById('bbpu').className = 'mbtn' + (m === 'BPU' ? ' on' : '');
  document.getElementById('doc-band').textContent =
    m === 'DQE' ? 'DETAIL QUANTITATIF ESTIMATIF' : 'BORDEREAU DES PRIX UNITAIRES';

  // Save current manual column widths BEFORE rebuilding colgroup
  const savedWidths = {};
  if (!colAutofit) {
    ['cw-num','cw-desig','cw-unit','cw-qty','cw-pu','cw-tot'].forEach(id => {
      const el = document.getElementById(id);
      if (el) savedWidths[id] = el.value;
    });
  }

  // Rebuild colgroup and thead for the new mode
  const cg = document.querySelector('#tbl colgroup');
  if (cg) cg.innerHTML = m === 'DQE'
    ? `<col class="cn"/><col class="cd"/><col class="cu"/><col class="cq"/><col class="cp"/><col class="ct"/>`
    : `<col class="cn"/><col class="cd"/><col class="cp-bpu"/>`;

  const th = document.querySelector('#tbl thead tr');
  if (th) th.innerHTML = m === 'DQE'
    ? `<th>N°</th><th>DESIGNATION DES OUVRAGES</th><th>U</th><th>Quantité</th><th>PRIX U HT</th><th>MONTANT HT</th>`
    : `<th style="width:70px">N°</th><th>DESIGNATION DES OUVRAGES</th><th style="width:130px">PRIX UNITAIRE HT</th>`;

  // Restore manual widths if applicable
  if (!colAutofit) {
    Object.entries(savedWidths).forEach(([id, val]) => {
      const el = document.getElementById(id); if (el) el.value = val;
    });
    applyColWidths();
  }

  // Update column panel visibility
  document.querySelectorAll('.dqe-col').forEach(el =>
    el.style.display = m === 'BPU' ? 'none' : 'flex'
  );

  render();
}
