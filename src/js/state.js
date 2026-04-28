/**
 * state.js — État global mutable de l'application.
 * Toutes les variables partagées entre modules sont ici.
 * Les modules lisent/écrivent ces variables directement (pas de store).
 */

let rows       = [];       // {type, id, desig, ...} — tableau principal
let mode       = 'DQE';   // 'DQE' | 'BPU'
let nid        = 1;        // compteur uid
let selId      = null;     // ancre de sélection
let selIds     = new Set();// multi-sélection
let showPrices = true;     // afficher/masquer les prix
let currentFilePath = null;// chemin du fichier ouvert (Electron)
let searchQuery = '';      // texte courant de recherche
let searchResults = [];    // ids de lignes correspondant a la recherche
let searchIndex = -1;      // index actif dans searchResults

/** Palette de couleurs par type de ligne */
let C = {
  chapBg: '#c00000', chapFg: '#ffffff',
  sub1Bg: '#ffff00', sub1Fg: '#000000',
  sub2Bg: '#bdd7ee', sub2Fg: '#000000',
  sub3Bg: '#e2efda', sub3Fg: '#000000',
  artBg:  '#ffffff', artFg:  '#000000',
  saBg:   '#f5f5f5', saFg:   '#000000',
  tsBg:   '#c6efce', tsFg:   '#000000',
  tcBg:   '#ffff00', tcFg:   '#000000',
  gtBg:   '#ffff00', gtFg:   '#000000',
};

/** Undo / Redo */
let history = [];
let hIdx    = -1;

/** Autosave debounce handle */
let saveTimeout = null;

/** Drag IDs (multi-row drag) */
let dragIds = [];

/** Header lines — unlimited array of {text, style:'t1'|'t2'} */
let headerLines = [
  { text: '', style: 't1' },  // first line: big bold underlined
  { text: '', style: 't2' },  // subsequent: bold uppercase
];
let pageLayout = {
  size:        'A4',
  orient:      'portrait',
  mt: 15, mb: 15, ml: 15, mr: 15,
  header:      '',
  footer:      '',
  showPageNum: true,
  showDate:    false,
};

/**
 * Per-mode column widths (px) — always concrete values, never null.
 * DQE and BPU are completely independent.
 * Changed by user via column panel inputs or auto-fit button.
 * Saved to project file so widths persist across sessions.
 */
let colWidths = {
  DQE: { num: 55, desig: 0, unit: 38, qty: 88, pu: 90, tot: 108 },
  BPU: { num: 55, desig: 0, pu: 120 },
  // desig: 0 means "take remaining space" (flex/auto in live app, computed in print)
};
