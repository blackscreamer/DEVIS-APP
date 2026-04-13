/**
 * helpers.js — Fonctions utilitaires pures (sans effets de bord UI).
 */

/** Génère un id unique */
const uid = () => 'r' + (nid++);

/** Parse un string en nombre (gère virgule et point) */
const num = v => parseFloat(String(v || 0).replace(',', '.')) || 0;

/** Formate un nombre en DA avec suffixe — pour les 3 lignes totaux */
const da = n => n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';

/** Formate un nombre sans suffixe DA — pour les cellules du tableau */
const daNoUnit = n => n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Échappe HTML */
const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/** Chiffres romains */
function toRoman(n) { return ROMAN[n - 1] || String(n); }

/* ═══ Nombre → mots français (pour ligne BPU) ═══ */
function numToWordsFr(n) {
  n = Math.round(n);
  if (n === 0) return 'ZERO';
  if (n < 0)   return 'MOINS ' + numToWordsFr(-n);
  const ones = ['','UN','DEUX','TROIS','QUATRE','CINQ','SIX','SEPT','HUIT','NEUF',
    'DIX','ONZE','DOUZE','TREIZE','QUATORZE','QUINZE','SEIZE','DIX-SEPT','DIX-HUIT','DIX-NEUF'];
  const tens = ['','','VINGT','TRENTE','QUARANTE','CINQUANTE','SOIXANTE','SOIXANTE','QUATRE-VINGT','QUATRE-VINGT'];
  function b100(n) {
    if (n < 20) return ones[n];
    const t = Math.floor(n/10), u = n % 10;
    if (t===7) return u===1 ? 'SOIXANTE ET ONZE' : 'SOIXANTE-' + ones[10+u];
    if (t===8) return u===0 ? 'QUATRE-VINGTS' : 'QUATRE-VINGT-' + ones[u];
    if (t===9) return u===0 ? 'QUATRE-VINGT-DIX' : 'QUATRE-VINGT-' + ones[10+u];
    if (u===0) return tens[t];
    return tens[t] + (u===1 ? ' ET UN' : '-' + ones[u]);
  }
  function b1000(n) {
    if (n < 100) return b100(n);
    const h = Math.floor(n/100), r = n % 100;
    const hp = (h===1 ? 'CENT' : ones[h] + ' CENT') + (r===0 && h>1 ? 'S' : '');
    return r === 0 ? hp : hp + ' ' + b100(r);
  }
  let res = '', rem = n;
  if (rem >= 1000000) { const m = Math.floor(rem/1000000); res += b1000(m) + ' MILLION' + (m>1?'S':''); rem %= 1000000; if(rem)res+=' '; }
  if (rem >= 1000)    { const k = Math.floor(rem/1000);    res += (k===1 ? 'MILLE' : b1000(k) + ' MILLE');               rem %= 1000;    if(rem)res+=' '; }
  if (rem > 0) res += b1000(rem);
  return res;
}

/** Construit la ligne BPU en lettres sous la désignation */
function buildBpuSubline(unite, pu) {
  const uw = UNIT_WORDS[unite] || (unite ? unite.toUpperCase() : '');
  if (!showPrices || !pu) return uw;
  return uw + '\u00A0: ' + numToWordsFr(pu) + ' DINAR ALGERIEN';
}

/* ═══ Inputs numériques formatés (affiche comme Montant HT) ═══ */

/** Formate un nombre brut pour affichage */
function fmtNum(raw) {
  const n = parseFloat(raw);
  if (isNaN(n) || raw === '' || raw === undefined) return raw || '';
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Focus → affiche valeur brute pour édition */
function niFocus(el) {
  const raw = el.dataset.raw || '';
  el.value = raw;
  el.select();
}

/** Blur → reformate pour affichage */
function niBlur(el) {
  const raw = el.value.replace(',', '.');
  el.dataset.raw = raw;
  const n = parseFloat(raw);
  if (!isNaN(n) && raw !== '') el.value = n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Input → sync dataset.raw + appelle upd() */
function niInput(el, id, field) {
  el.dataset.raw = el.value;
  upd(id, field, el.value.replace(',', '.'));
}

/** Auto-resize textarea */
function ar(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

/** Notification toast */
function notif(m) {
  document.getElementById('nf-msg').textContent = m;
  bootstrap.Toast.getOrCreateInstance(document.getElementById('nf-toast')).show();
}
