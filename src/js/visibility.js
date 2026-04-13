/**
 * visibility.js — Détermine quelles lignes sont masquées (collapse).
 *
 * Une ligne est masquée si :
 *  - Elle est dans un chapitre collapsed
 *  - Elle est dans un sous-chapitre collapsed (ou dans un sous-sous-chap collapsed)
 *
 * @returns {Set<number>} indices des lignes masquées
 */
function buildVisibility() {
  const hidden = new Set();
  let collapsedChap  = false;
  let collapsedSubLv = null; // niveau du sous-chap collapsed (1/2/3)

  rows.forEach((r, i) => {
    if (r.type === 'chap') {
      collapsedChap  = r.collapsed;
      collapsedSubLv = null;
      return;
    }
    if (r.type === 'sub') {
      if (collapsedChap) { hidden.add(i); collapsedSubLv = null; return; }
      // Si on remonte d'un niveau, annuler le collapse du sous-chap précédent
      if (collapsedSubLv !== null && (r.level || 1) <= collapsedSubLv) collapsedSubLv = null;
      if (collapsedSubLv !== null) { hidden.add(i); return; }
      if (r.collapsed) collapsedSubLv = r.level || 1;
      return;
    }
    // art, subart, blank
    if (collapsedChap || collapsedSubLv !== null) hidden.add(i);
  });

  return hidden;
}
