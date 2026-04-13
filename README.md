# Devis BTP — DQE / BPU Pro
Application Electron pour la gestion de devis de construction (DQE et BPU) — Dinar Algérien.

---

## 🚀 Installation rapide

```bash
# 1. Installer Node.js (https://nodejs.org) — version 18+

# 2. Installer les dépendances
npm install

# 3. Lancer en développement
npm start

# 4. Compiler l'installeur Windows (.exe)
npm run build
```

Le fichier `.exe` se trouve dans `build/dist/`.

---

## 📁 Structure du projet

```
devis-electron/
├── package.json              # Config Electron + electron-builder
├── src/
│   ├── main.js               # Processus principal Electron (fenêtre, menus, dialogues)
│   ├── preload.js            # Pont sécurisé main ↔ renderer (contextBridge)
│   ├── index.html            # Shell HTML — charge tous les modules
│   ├── css/
│   │   ├── base.css          # Variables CSS, body, layout document
│   │   ├── toolbar.css       # Barre d'outils, mode toggle, TVA
│   │   ├── table.css         # Tableau, cellules, types de lignes, no-prices
│   │   ├── float-ctrl.css    # Panneau flottant d'actions
│   │   ├── colors-panel.css  # Offcanvas color picker
│   │   ├── footer.css        # Barre de totaux en bas
│   │   └── print.css         # Styles impression / PDF
│   ├── js/
│   │   ├── constants.js      # UNITS, ROMAN, UNIT_WORDS, clés
│   │   ├── state.js          # Variables globales (rows, mode, C, selIds…)
│   │   ├── helpers.js        # Fonctions pures (da, esc, numToWordsFr, ni*)
│   │   ├── history.js        # Undo/Redo (snapshot, undo, redo)
│   │   ├── numbering.js      # buildNums() — numérotation hiérarchique
│   │   ├── totals.js         # artTotal, computeTotals, grandTotal, recalc
│   │   ├── visibility.js     # buildVisibility() — collapse des groupes
│   │   ├── render.js         # render() — reconstruit le tbody complet
│   │   ├── selection.js      # Sélection simple / Ctrl / Shift + flottant
│   │   ├── rows.js           # addRow, delSelected, dupSelected, upd, collapse
│   │   ├── dragdrop.js       # Drag & drop des lignes
│   │   ├── colors.js         # syncColorPicker, applyColors
│   │   ├── prices.js         # togglePrices, applyPricesUI, setMode
│   │   ├── files.js          # Sauvegarde, chargement, autosave (Electron + browser)
│   │   ├── export.js         # Export Excel (XLSX) + import Excel
│   │   ├── ui.js             # Helpers UI mineurs (resize, save indicator)
│   │   └── init.js           # Bootstrap — window.onload
│   └── assets/
│       └── icon.png          # Icône de l'application (remplacer par la vôtre)
└── README.md
```

---

## 🗂 Données — Modèle

Chaque ligne du devis est un objet dans `rows[]` :

| type | Champs | Description |
|------|--------|-------------|
| `chap` | `desig`, `collapsed` | Chapitre (numéro romain I, II…) |
| `sub` | `desig`, `level` (1/2/3), `collapsed` | Sous-chapitre (numéro continu global) |
| `art` | `desig`, `unite`, `qty`, `pu`, `bpu_desig?`, `bpu_pu?` | Article |
| `subart` | idem art | Sous-article (a, b, c…) |
| `blank` | `desig` | Ligne description / vide |

---

## 🔧 Modifier l'application

| Ce que vous voulez changer | Fichier à modifier |
|----------------------------|--------------------|
| Couleurs par défaut        | `js/state.js` → objet `C` |
| Liste des unités           | `js/constants.js` → `UNITS` |
| Numérotation               | `js/numbering.js` |
| Calcul des totaux          | `js/totals.js` |
| Rendu d'une ligne          | `js/render.js` |
| Sauvegarder / Ouvrir       | `js/files.js` |
| Export Excel               | `js/export.js` |
| Menu natif Windows         | `src/main.js` → `buildMenu()` |
| Style du tableau           | `css/table.css` |
| Style du document imprimé | `css/print.css` |

---

## 📦 Prérequis

- **Node.js** 18+ — https://nodejs.org
- **npm** (inclus avec Node.js)
- **Windows 10/11** pour le build `.exe` (ou macOS / Linux pour leurs formats)

---

## 💡 Fonctionnalités

- ✅ DQE (6 colonnes) et BPU (3 colonnes) indépendants
- ✅ Hiérarchie : Chapitres > Sous-chapitres (niv. 1/2/3) > Articles > Sous-articles
- ✅ Numérotation : chiffres romains (chap), continue (sous-chap), 1.01 (articles)
- ✅ Totaux automatiques : sous-chapitre, chapitre, général HT, TVA, TTC
- ✅ Masquer/afficher les prix (impression sans prix)
- ✅ BPU : ligne unité + prix en lettres sous chaque article
- ✅ Couleurs personnalisables par type de ligne
- ✅ Multi-sélection (Ctrl+clic, Shift+clic)
- ✅ Drag & drop des lignes
- ✅ Undo/Redo (50 niveaux)
- ✅ Autosave localStorage + fichier (5 min)
- ✅ Export Excel (.xlsx)
- ✅ Export PDF via menu Fichier > Exporter PDF
- ✅ Import Excel
- ✅ Menus natifs Windows
