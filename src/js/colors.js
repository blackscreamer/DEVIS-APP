/**
 * colors.js — Color picker sync and live color patching.
 *
 * applyColors() is called on every oninput (continuous mouse drag).
 * It patches the existing DOM directly instead of calling render(),
 * which avoids a full table rebuild on every pixel of drag movement.
 * Autosave is debounced so it fires once the user stops dragging.
 */

let _colorDebounce = null;

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
  _patchColors();
  clearTimeout(_colorDebounce);
  _colorDebounce = setTimeout(triggerAutosave, 600);
}

/**
 * Directly updates inline styles of all colored table elements.
 * No render() call — O(rows) style writes, no layout reflows.
 */
function _patchColors() {
  const b = document.getElementById('body');
  if (!b) return;

  const paint = (tr, bg, fg) => {
    tr.querySelectorAll('td').forEach(td => { td.style.background = bg; });
    tr.querySelectorAll('td.nc').forEach(td => { td.style.color = fg; });
    tr.querySelectorAll('td.tc').forEach(td => { td.style.color = fg; });
    tr.querySelectorAll('.tot-label, .tot-val').forEach(el => { el.style.color = fg; });
    // chapter/sub inputs carry webkit-fill + caret
    tr.querySelectorAll('input.di').forEach(el => {
      el.style.color = fg;
      el.style.setProperty('-webkit-text-fill-color', fg);
      el.style.caretColor = fg;
    });
    tr.querySelectorAll('textarea.di').forEach(el => { el.style.color = fg; });
    tr.querySelectorAll('input.ni, select.ui').forEach(el => { el.style.color = fg; });
    // sub-article letter span (sits inside td > div > span)
    tr.querySelectorAll('td > div > span').forEach(el => { el.style.color = fg; });
  };

  b.querySelectorAll('tr.rc').forEach(tr => paint(tr, C.chapBg, C.chapFg));

  b.querySelectorAll('tr.rs').forEach(tr => {
    const lv = parseInt(tr.dataset.lv) || 1;
    const bg = lv === 1 ? C.sub1Bg : lv === 2 ? C.sub2Bg : C.sub3Bg;
    const fg = lv === 1 ? C.sub1Fg : lv === 2 ? C.sub2Fg : C.sub3Fg;
    paint(tr, bg, fg);
  });

  b.querySelectorAll('tr.ra').forEach(tr =>  paint(tr, C.artBg, C.artFg));
  b.querySelectorAll('tr.rsa').forEach(tr => paint(tr, C.saBg,  C.saFg));
  b.querySelectorAll('tr.rts').forEach(tr => paint(tr, C.tsBg,  C.tsFg));
  b.querySelectorAll('tr.rtc').forEach(tr => paint(tr, C.tcBg,  C.tcFg));
  b.querySelectorAll('tr.rgt, tr.rtva, tr.rttc').forEach(tr => paint(tr, C.gtBg, C.gtFg));
}
