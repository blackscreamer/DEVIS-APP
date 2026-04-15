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

/** Page layout settings for print/PDF */
let pageLayout = {
  size:        'A4',       // 'A4' | 'A3' | 'Letter' | 'Legal'
  orient:      'portrait', // 'portrait' | 'landscape'
  mt: 15, mb: 15,          // margins in mm
  ml: 15, mr: 15,
  header:      '',         // custom header text (left side)
  footer:      '',         // custom footer text (left side)
  showPageNum: true,       // show page number (right side of footer)
  showDate:    false,      // show date (right side of header)
};
