/**
 * constants.js — Constantes globales de l'application.
 * Ne pas modifier sans mettre à jour claude.md.
 */

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

const UNITS = ['M²','M³','ML','U','Ens','Kg','T','H','J','Forfait','Lot','M'];

const ROMAN = [
  'I','II','III','IV','V','VI','VII','VIII','IX','X',
  'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'
];

/** Map unité → libellé français pour la ligne BPU en lettres */
const UNIT_WORDS = {
  'M²':    'LE METRE CARRE',
  'M³':    'LE METRE CUBE',
  'ML':    'LE METRE LINEAIRE',
  'M':     'LE METRE',
  'U':     "L'UNITE",
  'Ens':   "L'ENSEMBLE",
  'Kg':    'LE KILOGRAMME',
  'T':     'LA TONNE',
  'H':     "L'HEURE",
  'J':     'LE JOUR',
  'Forfait':'LE FORFAIT',
  'Lot':   'LE LOT',
};

const STORAGE_KEY      = 'dqe_btp_v1_autosave';
const MAX_HIST         = 50;
const AUTOSAVE_DELAY   = 500;     // ms — debounce localStorage
const AUTOSAVE_FILE_MS = 5*60000; // 5 min — file system autosave
