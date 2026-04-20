/**
 * numbering.js — Calcule la numérotation de toutes les lignes.
 *
 * Règles :
 *  - Chapitres      : I, II, III… (chiffres romains, indépendants)
 *  - Sous-chapitres : hiérarchiques par niveau
 *      Niv.1 : 1, 2, 3…       (continu global, ne reset pas sur nouveau chap)
 *      Niv.2 : 1.1, 1.2, 2.1… (reset à 0 sur nouveau niv.1)
 *      Niv.3 : 1.1.1, 1.1.2…  (reset à 0 sur nouveau niv.2)
 *  - Articles       : subN.01, subN.02… (reset par sous-chapitre courant)
 *  - Sous-articles  : a), b), c)… (reset par article parent)
 *      → le préfixe lettre est mis DANS la colonne désignation, pas N°
 *
 * @returns {{ nums: string[], letters: string[] }}
 */
function buildNums() {
  // Separate counters per sub-chapter level
  let chapN = 0;
  let subCounters = [0, 0, 0]; // [lv1, lv2, lv3]
  let artN = 0, saIdx = 0;
  // Track current sub numbers at each level for display
  let curSub = ['', '', ''];

  const nums = [], letters = [];

  rows.forEach(r => {
    if (r.type === 'chap') {
      chapN++;
      artN = 0; saIdx = 0;
      // Don't reset subCounters — sub-chapter numbering is continuous
      nums.push(toRoman(chapN));
      letters.push('');

    } else if (r.type === 'sub') {
      const lv = (r.level || 1) - 1; // 0-indexed: 0=lv1, 1=lv2, 2=lv3
      // Increment this level, reset all deeper levels
      subCounters[lv]++;
      for (let j = lv + 1; j < 3; j++) subCounters[j] = 0;
      artN = 0; saIdx = 0;

      // Build display string: "3", "3.1", "3.1.2"
      let dispNum = String(subCounters[0]);
      if (lv >= 1) dispNum += '.' + subCounters[1];
      if (lv >= 2) dispNum += '.' + subCounters[2];

      nums.push(dispNum);
      letters.push('');

    } else if (r.type === 'art') {
      artN++; saIdx = 0;
      // Article number uses the level-1 sub counter (main sub-chapter)
      const subNum = subCounters[0] || 0;
      const a = artN < 10 ? '0' + artN : String(artN);
      nums.push(subNum + '.' + a);
      letters.push('');

    } else if (r.type === 'subart') {
      // Number cell is empty — letter goes inside the designation cell
      const letter = LETTERS[saIdx] || String(saIdx + 1);
      nums.push('');
      letters.push(letter + ')');
      saIdx++;

    } else {
      nums.push(''); letters.push('');
    }
  });

  return { nums, letters };
}
