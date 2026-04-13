/**
 * numbering.js — Calcule la numérotation de toutes les lignes.
 *
 * Règles :
 *  - Chapitres     : I, II, III… (chiffres romains indépendants)
 *  - Sous-chapitres: 1, 2, 3… CONTINUS à travers tous les chapitres
 *  - Articles      : subN.01, subN.02… reset par sous-chapitre
 *  - Sous-articles : a), b), c)… reset par article parent
 *
 * @returns {{ nums: string[], letters: string[] }}
 */
function buildNums() {
  let chapN = 0, subN = 0, artN = 0, saIdx = 0;
  const nums = [], letters = [];

  rows.forEach(r => {
    if (r.type === 'chap') {
      chapN++; artN = 0; saIdx = 0;
      nums.push(toRoman(chapN)); letters.push('');
    } else if (r.type === 'sub') {
      subN++; artN = 0; saIdx = 0;
      nums.push(String(subN)); letters.push('');
    } else if (r.type === 'art') {
      artN++; saIdx = 0;
      const a = artN < 10 ? '0' + artN : String(artN);
      nums.push(subN + '.' + a); letters.push('');
    } else if (r.type === 'subart') {
      nums.push('');
      letters.push(LETTERS[saIdx] || String(saIdx + 1));
      saIdx++;
    } else {
      nums.push(''); letters.push('');
    }
  });

  return { nums, letters };
}
