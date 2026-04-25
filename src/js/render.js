/**
 * render.js — Reconstruit tout le HTML du tbody.
 * Appelé après chaque modification structurelle (add, del, drag…).
 * Pour les mises à jour de valeurs uniquement → recalc() suffit.
 */

function render() {
  const hidden           = buildVisibility();
  const { nums, letters }= buildNums();
  const { chapT, subT }  = computeTotals();
  const isBPU            = mode === 'BPU';
  if (typeof computeSearchResults === 'function') computeSearchResults();
  let html               = '';
  let chapStk = [], subStk = [];

  /* ── Helpers : lignes totaux (DQE uniquement) ── */
  const subTotRow = (sub, vis) => {
    const h = vis ? '' : 'style="display:none"';
    // 6 cols: N°(1) + label(4) + val(1) = 6
    return `<tr class="rts" data-ts="${sub.id}" ${h}>
      <td style="background:${C.tsBg}"></td>
      <td colspan="4" style="background:${C.tsBg}"><span class="tot-label" style="color:${C.tsFg}">Total ${esc(sub.desig || '')}</span></td>
      <td class="tot-val price-cell" style="background:${C.tsBg};color:${C.tsFg}" id="st-${sub.id}"></td>
    </tr>`;
  };

  const chapTotRow = (chap) => `<tr class="rtc" data-tc="${chap.id}">
    <td style="background:${C.tcBg}"></td>
    <td colspan="4" style="background:${C.tcBg}"><span class="tot-label" style="color:${C.tcFg}">Total ${esc(chap.desig || '')}</span></td>
    <td class="tot-val price-cell" style="background:${C.tcBg};color:${C.tcFg}" id="ct-${chap.id}"></td>
  </tr>`;

  const addHereRow = () => `<tr class="add-here-row">
    <td colspan="${isBPU ? 3 : 6}">
      <div class="add-here-box">
        <span class="add-here-label">+ Ajouter ici</span>
        <button class="add-here-btn action" type="button" onclick="dupSelected();event.stopPropagation()">Dupliquer</button>
        <button class="add-here-btn action danger" type="button" onclick="delSelected();event.stopPropagation()">Supprimer</button>
        <button class="add-here-btn" type="button" onclick="addRowHere('chap');event.stopPropagation()">Chapitre</button>
        <button class="add-here-btn" type="button" onclick="addRowHere('sub',1);event.stopPropagation()">Sous-chapitre</button>
        <button class="add-here-btn" type="button" onclick="addRowHere('art');event.stopPropagation()">Article</button>
        <button class="add-here-btn" type="button" onclick="addRowHere('subart');event.stopPropagation()">Sous-article</button>
        <button class="add-here-btn" type="button" onclick="addRowHere('blank');event.stopPropagation()">Ligne vide</button>
      </div>
    </td>
  </tr>`;

  /* ── Itération des lignes ── */
  rows.forEach((r, i) => {
    const vis    = !hidden.has(i);
    const h      = vis ? '' : 'style="display:none"';
    const n      = nums[i];
    const letter = letters[i];
    const matchCls = typeof getSearchRowClass === 'function' ? getSearchRowClass(r.id) : '';
    const selCls = selIds.has(r.id)
      ? (selIds.size === 1 ? ' sel-row' : r.id === selId ? ' sel-row' : ' sel-multi')
      : '';

    /* ─ CHAPITRE ─ */
    if (r.type === 'chap') {
      if (!isBPU) { while (subStk.length) { const s = subStk.pop(); html += subTotRow(s, false); } if (chapStk.length) html += chapTotRow(chapStk.pop()); }
      else         { subStk = []; chapStk = []; }
      chapStk.push({ id: r.id, desig: r.desig });
      const cs = isBPU ? '1' : '4'; // colspan désignation
      html += `<tr class="rc${selCls}${matchCls}" id="ro-${r.id}" draggable="false" onclick="selectRow('${r.id}',this,event)">
        <td class="nc" style="background:${C.chapBg};color:${C.chapFg};cursor:pointer" onclick="toggleCollapse('${r.id}',event)">${r.collapsed ? '▸' : '▾'} ${esc(n)}</td>
        <td colspan="${isBPU ? 2 : 5}" style="background:${C.chapBg}">
          <input class="di" value="${esc(r.desig)}" placeholder="Nom du chapitre…"
            style="color:${C.chapFg}!important;-webkit-text-fill-color:${C.chapFg};caret-color:${C.chapFg};font-weight:bold;font-size:12pt;text-transform:uppercase"
            oninput="upd('${r.id}','desig',this.value)"/>
        </td>
      </tr>`;
      if (selIds.size === 1 && selId === r.id && vis) html += addHereRow();
    }

    /* ─ SOUS-CHAPITRE ─ */
    else if (r.type === 'sub') {
      const lv = r.level || 1;
      if (!isBPU) { while (subStk.length && subStk[subStk.length-1].level >= lv) { const s = subStk.pop(); html += subTotRow(s, !hidden.has(rows.findIndex(x => x.id === s.id))); } }
      else         { while (subStk.length && subStk[subStk.length-1].level >= lv) subStk.pop(); }
      subStk.push({ id: r.id, desig: r.desig, level: lv });
      const bg = lv===1 ? C.sub1Bg : lv===2 ? C.sub2Bg : C.sub3Bg;
      const fg = lv===1 ? C.sub1Fg : lv===2 ? C.sub2Fg : C.sub3Fg;
      const pl = (lv-1)*20 + 8;
      const cs = isBPU ? '1' : '4';
      html += `<tr class="rs${selCls}${matchCls}" id="ro-${r.id}" ${h} onclick="selectRow('${r.id}',this,event)">
        <td class="nc" style="background:${bg};color:${fg};cursor:pointer;font-weight:bold" onclick="toggleCollapse('${r.id}',event)">${r.collapsed ? '▸' : '▾'} ${esc(n)}</td>
        <td colspan="${isBPU ? 2 : 5}" style="background:${bg}">
          <input class="di" value="${esc(r.desig)}" placeholder="Nom du sous-chapitre…"
            style="color:${fg}!important;-webkit-text-fill-color:${fg};caret-color:${fg};font-weight:bold;text-transform:uppercase;padding-left:${pl}px"
            oninput="upd('${r.id}','desig',this.value)"/>
        </td>
      </tr>`;
      if (selIds.size === 1 && selId === r.id && vis) html += addHereRow();
    }

    /* ─ ARTICLE ─ */
    else if (r.type === 'art') {
      const hasKids = artHasSubarts(r.id);
      if (isBPU) {
        const bDesig  = r.bpu_desig  !== undefined ? r.bpu_desig  : r.desig;
        const bPu     = r.bpu_pu     !== undefined ? r.bpu_pu     : r.pu;
        const bUnite  = r.bpu_unite  !== undefined ? r.bpu_unite  : r.unite;
        const subline = !hasKids ? buildBpuSubline(bUnite, num(bPu)) : '';
        html += `<tr class="ra${selCls}${matchCls}" id="ro-${r.id}" ${h} onclick="selectRow('${r.id}',this,event)">
          <td class="nc" style="background:${C.artBg};color:${C.artFg}">${esc(n)}</td>
          <td style="background:${C.artBg}">
            <textarea class="di" rows="1" placeholder="${esc(r.desig || 'Désignation BPU…')}" style="color:${C.artFg}"
              oninput="upd('${r.id}','bpu_desig',this.value);ar(this)" onfocus="ar(this)">${esc(bDesig)}</textarea>
            ${subline ? `<div class="bpu-subline" id="sl-${r.id}">${subline}</div>` : `<div id="sl-${r.id}"></div>`}
          </td>
          ${hasKids
            ? `<td style="background:${C.artBg}"></td>`
            : `<td class="price-cell" style="background:${C.artBg}">
                <input class="ni" type="text" inputmode="decimal"
                  value="${esc(fmtNum(bPu))}" data-raw="${esc(bPu)}" placeholder="0,00"
                  style="color:${C.artFg}" onfocus="niFocus(this)" onblur="niBlur(this)"
                  oninput="niInput(this,'${r.id}','bpu_pu')"/>
              </td>`}
        </tr>`;
        if (selIds.size === 1 && selId === r.id && vis) html += addHereRow();
      } else {
        const t = hasKids ? 0 : artTotal(r);
        html += `<tr class="ra${selCls}${matchCls}" id="ro-${r.id}" ${h} onclick="selectRow('${r.id}',this,event)">
          <td class="nc" style="background:${C.artBg};color:${C.artFg}">${esc(n)}</td>
          <td style="background:${C.artBg}">
            <textarea class="di" rows="1" placeholder="Désignation de l'article…" style="color:${C.artFg}"
              oninput="upd('${r.id}','desig',this.value);ar(this)" onfocus="ar(this)">${esc(r.desig)}</textarea>
          </td>
          ${hasKids
            ? `<td style="background:${C.artBg}"></td><td style="background:${C.artBg}"></td><td style="background:${C.artBg}"></td>`
            : `<td style="background:${C.artBg}">
                <select class="ui" style="color:${C.artFg}" onchange="upd('${r.id}','unite',this.value)">
                  ${UNITS.map(u => `<option${r.unite===u?' selected':''}>${u}</option>`).join('')}
                </select>
              </td>
              <td style="background:${C.artBg}">
                <input class="ni" type="text" inputmode="decimal"
                  value="${esc(fmtNum(r.qty))}" data-raw="${esc(r.qty)}" placeholder="0"
                  style="color:${C.artFg}" onfocus="niFocus(this)" onblur="niBlur(this)"
                  oninput="niInput(this,'${r.id}','qty')" onkeydown="kn(event,'${r.id}','q')"/>
              </td>
              <td class="price-cell" style="background:${C.artBg}">
                <input class="ni" type="text" inputmode="decimal"
                  value="${esc(fmtNum(r.pu))}" data-raw="${esc(r.pu)}" placeholder="0,00"
                  style="color:${C.artFg}" onfocus="niFocus(this)" onblur="niBlur(this)"
                  oninput="niInput(this,'${r.id}','pu')" onkeydown="kn(event,'${r.id}','p')"/>
              </td>`}
          <td class="tc${t?' v':''} price-cell" style="background:${C.artBg};color:${C.artFg}" id="at-${r.id}">${t ? daNoUnit(t) : ''}</td>
        </tr>`;
        if (selIds.size === 1 && selId === r.id && vis) html += addHereRow();
      }
    }

    /* ─ SOUS-ARTICLE ─ */
    else if (r.type === 'subart') {
      if (isBPU) {
        const bDesig = r.bpu_desig !== undefined ? r.bpu_desig : r.desig;
        const bPu    = r.bpu_pu   !== undefined ? r.bpu_pu   : r.pu;
        const bUnite = r.bpu_unite!== undefined ? r.bpu_unite: r.unite;
        const subline= buildBpuSubline(bUnite, num(bPu));
        html += `<tr class="rsa${selCls}${matchCls}" id="ro-${r.id}" ${h} onclick="selectRow('${r.id}',this,event)">
          <td class="nc" style="background:${C.saBg};color:${C.saFg};"></td>
          <td style="background:${C.saBg};padding:0">
            <div style="display:flex;align-items:flex-start;padding:2px 5px 0">
              <span style="font-family:var(--F);font-size:var(--SZ);color:${C.saFg};font-weight:bold;white-space:nowrap;padding-top:2px;min-width:22px;flex-shrink:0">${esc(letter)}</span>
              <textarea class="di" rows="1" placeholder="Sous-article BPU…" style="color:${C.saFg};padding:0;flex:1"
                oninput="upd('${r.id}','bpu_desig',this.value);ar(this)" onfocus="ar(this)">${esc(bDesig)}</textarea>
            </div>
            <div class="bpu-subline" id="sl-${r.id}">${subline}</div>
          </td>
          <td class="price-cell" style="background:${C.saBg}">
            <input class="ni" type="text" inputmode="decimal"
              value="${esc(fmtNum(bPu))}" data-raw="${esc(bPu)}" placeholder="0,00"
              style="color:${C.saFg}" onfocus="niFocus(this)" onblur="niBlur(this)"
              oninput="niInput(this,'${r.id}','bpu_pu')"/>
          </td>
        </tr>`;
        if (selIds.size === 1 && selId === r.id && vis) html += addHereRow();
      } else {
        const t = artTotal(r);
        html += `<tr class="rsa${selCls}${matchCls}" id="ro-${r.id}" ${h} onclick="selectRow('${r.id}',this,event)">
          <td class="nc" style="background:${C.saBg};color:${C.saFg};"></td>
          <td style="background:${C.saBg};padding:0">
            <div style="display:flex;align-items:flex-start;padding:2px 5px 0">
              <span style="font-family:var(--F);font-size:var(--SZ);color:${C.saFg};font-weight:bold;white-space:nowrap;padding-top:2px;min-width:22px;flex-shrink:0">${esc(letter)}</span>
              <textarea class="di" rows="1" placeholder="Sous-article (ex: ø 110mm)…" style="color:${C.saFg};padding:0;flex:1"
                oninput="upd('${r.id}','desig',this.value);ar(this)" onfocus="ar(this)">${esc(r.desig)}</textarea>
            </div>
          </td>
          <td style="background:${C.saBg}">
            <select class="ui" style="color:${C.saFg}" onchange="upd('${r.id}','unite',this.value)">
              ${UNITS.map(u => `<option${r.unite===u?' selected':''}>${u}</option>`).join('')}
            </select>
          </td>
          <td style="background:${C.saBg}">
            <input class="ni" type="text" inputmode="decimal"
              value="${esc(fmtNum(r.qty))}" data-raw="${esc(r.qty)}" placeholder="0"
              style="color:${C.saFg}" onfocus="niFocus(this)" onblur="niBlur(this)"
              oninput="niInput(this,'${r.id}','qty')"/>
          </td>
          <td class="price-cell" style="background:${C.saBg}">
            <input class="ni" type="text" inputmode="decimal"
              value="${esc(fmtNum(r.pu))}" data-raw="${esc(r.pu)}" placeholder="0,00"
              style="color:${C.saFg}" onfocus="niFocus(this)" onblur="niBlur(this)"
              oninput="niInput(this,'${r.id}','pu')"/>
          </td>
          <td class="tc${t?' v':''} price-cell" style="background:${C.saBg};color:${C.saFg}" id="at-${r.id}">${t ? daNoUnit(t) : ''}</td>
        </tr>`;
        if (selIds.size === 1 && selId === r.id && vis) html += addHereRow();
      }
    }

    /* ─ LIGNE VIDE / DESCRIPTION ─ */
    else if (r.type === 'blank') {
      // DQE: 6 cols → N°(1) + desig colspan=5 = 6
      // BPU: 3 cols → N°(1) + desig colspan=2 = 3
      const cs = isBPU ? '2' : '5';
      html += `<tr class="rb${selCls}${matchCls}" id="ro-${r.id}" ${h} onclick="selectRow('${r.id}',this,event)">
        <td style="background:#fff"></td>
        <td colspan="${cs}" style="background:#fff">
          <input class="di" value="${esc(r.desig)}" placeholder="Note / description…"
            style="font-style:italic;color:#333" oninput="upd('${r.id}','desig',this.value)"/>
        </td>
      </tr>`;
      if (selIds.size === 1 && selId === r.id && vis) html += addHereRow();
    }
  });

  /* ── Fermer les groupes ouverts ── */
  if (!isBPU) {
    while (subStk.length)  { const s = subStk.pop();  html += subTotRow(s, true); }
    if   (chapStk.length)  html += chapTotRow(chapStk.pop());

    const grand   = grandTotal();
    const tvaPct  = num(document.getElementById('tva').value) / 100;
    const tvaAmt  = grand * tvaPct;
    const tvaLbl  = document.getElementById('tva').value;
    html += `<tr class="rgt">
      <td style="background:${C.gtBg}"></td>
      <td colspan="4" style="background:${C.gtBg}"><span class="tot-label" style="color:${C.gtFg};font-size:12pt">TOTAL GÉNÉRAL HT</span></td>
      <td class="tot-val price-cell" style="background:${C.gtBg};color:${C.gtFg};font-size:12pt" id="gt-val">${da(grand)}</td>
    </tr>
    <tr class="rtva">
      <td style="background:${C.gtBg}"></td>
      <td colspan="4" style="background:${C.gtBg}"><span class="tot-label" id="tva-label" style="color:${C.gtFg}">TVA (${tvaLbl}%)</span></td>
      <td class="tot-val price-cell" style="background:${C.gtBg};color:${C.gtFg}" id="tva-val">${da(tvaAmt)}</td>
    </tr>
    <tr class="rttc">
      <td style="background:${C.gtBg}"></td>
      <td colspan="4" style="background:${C.gtBg}"><span class="tot-label" style="color:${C.gtFg};font-size:12pt">TOTAL TTC</span></td>
      <td class="tot-val price-cell" style="background:${C.gtBg};color:${C.gtFg};font-size:12pt" id="ttc-val">${da(grand + tvaAmt)}</td>
    </tr>`;
  }

  document.getElementById('body').innerHTML = html;

  /* Réattacher les drag/drop listeners */
  document.querySelectorAll('#body tr[id^="ro-"]').forEach(tr => {
    tr.addEventListener('dragover',  e => { e.preventDefault(); dov2(e, tr); });
    tr.addEventListener('dragleave', e => dlv2(tr));
    tr.addEventListener('drop',      e => dp2(e, tr));
  });

  document.querySelectorAll('#body tr[id^="ro-"] input, #body tr[id^="ro-"] textarea, #body tr[id^="ro-"] select').forEach(el => {
    el.addEventListener('focus', () => {
      const tr = el.closest('tr[id^="ro-"]');
      if (!tr) return;
      const id = tr.id.replace('ro-', '');
      if (!selIds.has(id) || selIds.size !== 1) selectRowSoft(id, tr);
    });
    el.addEventListener('mousedown', () => {
      const tr = el.closest('tr[id^="ro-"]');
      if (!tr) return;
      const id = tr.id.replace('ro-', '');
      if (!selIds.has(id) || selIds.size !== 1) selectRowSoft(id, tr);
    });
  });

  /* Rétablir les hauteurs des textareas */
  document.querySelectorAll('textarea.di').forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });

  /* Rétablir la sélection visuelle */
  if (selIds.size) {
    if (typeof markSelectionUI === 'function') markSelectionUI();
  } else {
    clearSelection(false);
  }

  recalc(false);
  if (typeof syncSearchUI === 'function') syncSearchUI();
}

/* Keyboard nav Tab entre cellules numériques */
function kn(e, id, f) {
  if (e.key === 'Tab' || (e.key === 'Enter' && f === 'p')) {
    e.preventDefault();
    const art = rows.filter(r => r.type === 'art' || r.type === 'subart');
    const idx = art.findIndex(r => r.id === id);
    if (f === 'q') { fc2(id, 'p'); return; }
    if (f === 'p') {
      if (idx < art.length - 1) fc2(art[idx + 1].id, 'q');
      else { selId = id; addRow('art'); }
    }
  }
}

function fc2(id, f) {
  setTimeout(() => {
    const tr = document.getElementById('ro-' + id);
    if (!tr) return;
    const ins  = tr.querySelectorAll('input.ni');
    const inp2 = f === 'q' ? ins[0] : ins[1];
    if (inp2) { inp2.focus(); inp2.select(); }
  }, 20);
}
