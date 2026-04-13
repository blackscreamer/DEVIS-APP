/**
 * colors.js — Synchronisation du color picker et application des couleurs.
 */

function syncColorPicker() {
  const map = {
    'cc-chap-bg': C.chapBg, 'cc-chap-fg': C.chapFg,
    'cc-sub1-bg': C.sub1Bg, 'cc-sub1-fg': C.sub1Fg,
    'cc-sub2-bg': C.sub2Bg, 'cc-sub2-fg': C.sub2Fg,
    'cc-sub3-bg': C.sub3Bg, 'cc-sub3-fg': C.sub3Fg,
    'cc-art-bg':  C.artBg,  'cc-art-fg':  C.artFg,
    'cc-sa-bg':   C.saBg,   'cc-sa-fg':   C.saFg,
    'cc-ts-bg':   C.tsBg,   'cc-ts-fg':   C.tsFg,
    'cc-tc-bg':   C.tcBg,   'cc-tc-fg':   C.tcFg,
    'cc-gt-bg':   C.gtBg,   'cc-gt-fg':   C.gtFg,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function applyColors() {
  const g = id => document.getElementById(id)?.value || '#000';
  C = {
    chapBg: g('cc-chap-bg'), chapFg: g('cc-chap-fg'),
    sub1Bg: g('cc-sub1-bg'), sub1Fg: g('cc-sub1-fg'),
    sub2Bg: g('cc-sub2-bg'), sub2Fg: g('cc-sub2-fg'),
    sub3Bg: g('cc-sub3-bg'), sub3Fg: g('cc-sub3-fg'),
    artBg:  g('cc-art-bg'),  artFg:  g('cc-art-fg'),
    saBg:   g('cc-sa-bg'),   saFg:   g('cc-sa-fg'),
    tsBg:   g('cc-ts-bg'),   tsFg:   g('cc-ts-fg'),
    tcBg:   g('cc-tc-bg'),   tcFg:   g('cc-tc-fg'),
    gtBg:   g('cc-gt-bg'),   gtFg:   g('cc-gt-fg'),
  };
  render();
  triggerAutosave();
}
