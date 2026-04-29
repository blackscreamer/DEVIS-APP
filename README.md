# Devis BTP — DQE / BPU

Application desktop de gestion de devis pour le secteur **BTP** (Bâtiment et Travaux Publics) en Algérie.  
Génère des **Détails Quantitatifs Estimatifs (DQE)** et des **Bordereaux des Prix Unitaires (BPU)** avec export Excel, PDF et impression.

---

## Sommaire

1. [Aperçu](#aperçu)
2. [Fonctionnalités](#fonctionnalités)
3. [Installation & Démarrage](#installation--démarrage)
4. [Structure du projet](#structure-du-projet)
5. [Architecture technique](#architecture-technique)
6. [Modèle de données](#modèle-de-données)
7. [Format de fichier `.devis`](#format-de-fichier-devis)
8. [Numérotation](#numérotation)
9. [Raccourcis clavier](#raccourcis-clavier)
10. [Export et impression](#export-et-impression)
11. [Personnalisation des couleurs](#personnalisation-des-couleurs)
12. [Largeur des colonnes](#largeur-des-colonnes)
13. [Modules JavaScript](#modules-javascript)
14. [Build et distribution](#build-et-distribution)

---

## Aperçu

![Landing page](src/assets/icon.ico)

L'application démarre sur une **page d'accueil** permettant de créer un nouveau projet (DQE ou BPU) ou d'ouvrir un fichier récent. Les projets sont sauvegardés dans le format propriétaire `.devis` (JSON interne).

### Modes

| Mode | Description |
|------|-------------|
| **DQE** | Détail Quantitatif Estimatif — colonnes : N°, Désignation, U, Quantité, P.U HT, Montant HT |
| **BPU** | Bordereau des Prix Unitaires — colonnes : N°, Désignation, Prix Unitaire HT |

---

## Fonctionnalités

### Édition
- Structure hiérarchique : **Chapitre → Sous-chapitre (3 niveaux) → Article → Sous-article**
- Ajout, suppression, duplication de lignes
- **Glisser-déposer** pour réorganiser les lignes
- **Multi-sélection** : Ctrl+clic, Shift+clic
- Retour à la ligne dans les désignations (Entrée) — respecté à l'export
- Lignes de description libres (notes/commentaires)
- Annuler / Rétablir (50 étapes, Ctrl+Z / Ctrl+Y)

### Calculs automatiques
- Totaux par article, sous-chapitre, chapitre
- Grand total HT, TVA (taux configurable), Total TTC
- Montant TTC en chiffres et en lettres (français)
- Sous-ligne BPU avec prix en lettres par unité

### Affichage
- **Masquer/afficher les prix** (Ctrl+Shift+H) — les colonnes gardent la même largeur
- Réduire/développer les chapitres et sous-chapitres
- Couleurs personnalisables par type de ligne
- Recherche dans le document (Ctrl+F) avec navigation résultat par résultat
- Espace de travail A4 fidèle aux paramètres de mise en page

### Export
- **Excel (.xlsx)** — mise en forme complète (couleurs, bordures, polices)
- **PDF** — via fenêtre de rendu Chromium
- **Impression** — dialogue système natif avec aperçu

### Persistance
- Autosauvegarde dans `localStorage` (500 ms de debounce)
- Sauvegarde fichier manuelle et automatique (toutes les 5 min)
- Fichiers récents (10 derniers) sur la page d'accueil
- Dialogue de confirmation à la fermeture si modifications non sauvegardées

---

## Installation & Démarrage

### Prérequis
- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v9+

### Développement

```bash
git clone https://github.com/blackscreamer/DEVIS-APP.git
cd DEVIS-APP
npm install
npm run dev          # lance l'app en mode développement (DevTools ouverts)
```

### Production

```bash
npm start            # lance sans DevTools
```

### Build installateur Windows

```bash
npm run build        # génère build/dist/Devis BTP Setup.exe
```

L'installateur enregistre l'extension `.devis` dans le registre Windows → double-clic sur un fichier `.devis` ouvre directement l'application.

---

## Structure du projet

```
DEVIS-APP/
├── package.json               # config Electron + electron-builder
├── src/
│   ├── main.js                # Processus principal Electron
│   ├── preload.js             # Pont sécurisé main ↔ éditeur
│   ├── preload-landing.js     # Pont sécurisé main ↔ landing
│   ├── preload-preview.js     # Pont sécurisé main ↔ fenêtre impression
│   ├── index.html             # Interface éditeur principale
│   ├── landing.html           # Page d'accueil
│   ├── assets/
│   │   ├── icon.ico           # Icône Windows
│   │   └── icon.png           # Icône Linux/macOS
│   ├── css/
│   │   ├── base.css           # Layout global, espace de travail A4
│   │   ├── toolbar.css        # Barre d'outils + barre de recherche
│   │   ├── table.css          # Table, types de lignes, mode no-prices
│   │   ├── sidepanel.css      # Panneau latéral fixe (actions)
│   │   ├── float-ctrl.css     # Ancien float (désactivé, conservé)
│   │   ├── colors-panel.css   # Panneau couleurs offcanvas
│   │   ├── footer.css         # Barre de totaux en bas
│   │   └── print.css          # Styles impression / @media print
│   ├── js/
│   │   ├── state.js           # État global mutable (rows, mode, C, …)
│   │   ├── constants.js       # Constantes (UNITS, ROMAN, UNIT_WORDS, …)
│   │   ├── helpers.js         # Fonctions utilitaires (esc, da, num, …)
│   │   ├── numbering.js       # Calcul de la numérotation hiérarchique
│   │   ├── visibility.js      # Logique collapse/expand des groupes
│   │   ├── totals.js          # Calcul des totaux + recalc() sans render()
│   │   ├── render.js          # Reconstruction du tbody + listeners
│   │   ├── selection.js       # Sélection (simple/Ctrl/Shift) SANS render()
│   │   ├── sidepanel.js       # Mise à jour du panneau latéral fixe
│   │   ├── rows.js            # Ajout, suppression, duplication, upd()
│   │   ├── dragdrop.js        # Glisser-déposer de lignes
│   │   ├── history.js         # Undo/redo (50 étapes)
│   │   ├── colors.js          # Palette couleurs + synchronisation UI
│   │   ├── prices.js          # Toggle prix + setMode(DQE/BPU)
│   │   ├── ui.js              # En-têtes dynamiques, dimensions A4, colonnes
│   │   ├── search.js          # Recherche en temps réel + navigation
│   │   ├── files.js           # Sauvegarde, chargement, buildPrintHTML()
│   │   ├── export.js          # Export Excel (ExcelJS styled + SheetJS fallback)
│   │   └── init.js            # Initialisation au chargement de la page
│   └── vendor/                # Assets locaux (pas de CDN — fonctionne hors-ligne)
│       ├── bootstrap/
│       ├── bootstrap-icons/
│       ├── exceljs/
│       └── xlsx/
```

---

## Architecture technique

### Processus Electron

```
main.js (Node.js)
  │
  ├── landing.html  ← preload-landing.js ← landingAPI (IPC)
  │     Nouveau DQE/BPU, fichiers récents, ouvrir
  │
  └── index.html    ← preload.js ← electronAPI (IPC)
        Éditeur principal
        │
        └── [print window]  ← window.print() via executeJavaScript
```

### IPC Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `landing:new` | renderer→main | Nouveau projet (mode DQE ou BPU) |
| `landing:open` | renderer→main | Ouvre un dialogue fichier |
| `landing:openRecent` | renderer→main | Ouvre un fichier récent |
| `landing:removeRecent` | renderer→main | Retire un fichier des récents |
| `recents:updated` | main→renderer | Met à jour la liste des récents |
| `dialog:save` | renderer→main | Sauvegarde (dialogue si nouveau) |
| `dialog:saveAs` | renderer→main | Sauvegarder sous… |
| `dialog:saveExcel` | renderer→main | Dialogue sauvegarde Excel |
| `file:saveBackup` | renderer→main | Sauvegarde automatique 5 min |
| `file:print` | renderer→main | Ouvre fenêtre impression |
| `file:exportPdf` | renderer→main | Export PDF via printToPDF |
| `file:opened` | main→renderer | Contenu du fichier chargé |
| `file:importExcel` | main→renderer | Buffer Excel à importer |
| `dirty:update` | renderer→main | Signale modifications non sauvegardées |
| `menu:*` | main→renderer | Actions menu (new, save, mode, undo…) |

### Stratégie de performance

**Sélection de lignes — sans re-render :**
La sélection manipule uniquement les classes CSS sur les `<tr>` existants (`classList.add/remove`). `render()` n'est jamais appelé lors d'un clic sur une ligne.

**`render()` appelé uniquement pour :**
- Ajout / suppression / duplication de lignes
- Changement de mode (DQE ↔ BPU)
- Collapse / expand de chapitres
- Chargement d'un fichier

**`recalc()` sans render() pour :**
- Modification d'un champ (désignation, quantité, prix)
- Changement du taux TVA
- Met à jour uniquement les cellules de valeur (IDs connus)

**Debounce dans `upd()` :** 150 ms — une seule passe `recalc()` par burst de frappes.

---

## Modèle de données

### Structure d'une ligne (`rows[]`)

```js
// Chapitre
{ type: 'chap', id: 'abc1', desig: 'TERRASSEMENTS', collapsed: false }

// Sous-chapitre (niveau 1, 2, ou 3)
{ type: 'sub',  id: 'abc2', desig: '01 - FOUILLES', level: 1, collapsed: false }

// Article (DQE)
{
  type:  'art',
  id:    'abc3',
  desig: 'Terrassement en grande masse…',
  unite: 'M³',
  qty:   '3555',
  pu:    '400',
  // Champs BPU optionnels (si différents des champs DQE)
  bpu_desig: 'Terrassement…',
  bpu_pu:    '400',
  bpu_unite: 'M³',
}

// Sous-article
{ type: 'subart', id: 'abc4', desig: 'Diamètre ø110', unite: 'ML', qty: '12', pu: '850' }

// Ligne vide / note
{ type: 'blank', id: 'abc5', desig: 'Note : prix hors fourniture' }
```

### Palette de couleurs (`C`)

```js
C = {
  chapBg: '#c00000', chapFg: '#ffffff',  // Rouge / blanc
  sub1Bg: '#ffff00', sub1Fg: '#000000',  // Jaune / noir
  sub2Bg: '#bdd7ee', sub2Fg: '#000000',  // Bleu clair
  sub3Bg: '#e2efda', sub3Fg: '#000000',  // Vert clair
  artBg:  '#ffffff', artFg:  '#000000',  // Blanc
  saBg:   '#f5f5f5', saFg:   '#000000',  // Gris très clair
  tsBg:   '#c6efce', tsFg:   '#000000',  // Vert (total sous-chap)
  tcBg:   '#ffff00', tcFg:   '#000000',  // Jaune (total chap)
  gtBg:   '#ffff00', gtFg:   '#000000',  // Jaune (grand total)
}
```

---

## Format de fichier `.devis`

Le fichier `.devis` est du JSON valide, sauvegardé en UTF-8.

```json
{
  "v": 9,
  "mode": "DQE",
  "nid": 42,
  "showPrices": true,
  "tva": "19",
  "rows": [ ... ],
  "headerLines": [
    { "text": "PROJET : REALISATION D'UN COLLEGE", "style": "t1" },
    { "text": "COMMUNE DE CONSTANTINE", "style": "t2" }
  ],
  "C": { "chapBg": "#c00000", "chapFg": "#ffffff", ... },
  "pageLayout": {
    "size": "A4",
    "orient": "portrait",
    "mt": 15, "mb": 15, "ml": 15, "mr": 15,
    "header": "",
    "footer": "",
    "showPageNum": true,
    "showDate": false
  },
  "colWidths": {
    "DQE": { "num": 55, "desig": 0, "unit": 38, "qty": 88, "pu": 90, "tot": 108 },
    "BPU": { "num": 55, "desig": 0, "pu": 120 }
  }
}
```

### Migration automatique

Les anciens fichiers `.json` (formats v1 à v8) sont chargés automatiquement :
- Champs `l1`, `l2`, `l3` → convertis en `headerLines[]`
- Champ `projet` (très anciens) → `headerLines[0]`
- Valeurs `null` dans `colWidths` → remplacées par les défauts

---

## Numérotation

| Type | Format | Exemple |
|------|--------|---------|
| Chapitre | Chiffres romains | I, II, III… |
| Sous-chap. niv. 1 | Entier continu | 1, 2, 3… |
| Sous-chap. niv. 2 | Hiérarchique | 1.1, 1.2, 2.1… |
| Sous-chap. niv. 3 | Hiérarchique | 1.1.1, 1.1.2… |
| Article | SubN.XX | 1.01, 1.02, 2.01… |
| Sous-article | Lettre | a), b), c)… affichée dans la cellule Désignation |

Les compteurs d'articles se remettent à zéro à chaque nouveau sous-chapitre (tous niveaux).

---

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+Z` | Annuler |
| `Ctrl+Y` | Rétablir |
| `Ctrl+S` | Sauvegarder |
| `Ctrl+Shift+S` | Sauvegarder sous… |
| `Ctrl+E` | Exporter Excel |
| `Ctrl+Shift+E` | Exporter PDF |
| `Ctrl+P` | Imprimer |
| `Ctrl+F` | Rechercher |
| `Ctrl+Shift+H` | Masquer / Afficher les prix |
| `Ctrl+D` | Dupliquer la sélection |
| `Suppr` | Supprimer la sélection |
| `+` | Ajouter un article après la sélection |
| `Échap` | Effacer la recherche |
| `Entrée` (recherche) | Résultat suivant |
| `Shift+Entrée` (recherche) | Résultat précédent |
| `Ctrl+clic` | Multi-sélection |
| `Shift+clic` | Sélection en plage |

---

## Export et impression

### Excel (ExcelJS)
- Couleurs de cellules identiques à la palette `C`
- Police Times New Roman, taille 10–12pt
- Bordures fines sur toutes les cellules
- Lignes de totaux avec couleurs distinctes
- BPU : ligne en lettres (prix en toutes lettres par unité)
- DQE : totaux sous-chapitre, chapitre, HT, TVA, TTC
- En-têtes de colonnes figées (freeze panes)

### PDF
1. `buildPrintHTML()` génère un HTML autonome depuis `rows[]`
2. Tous les styles sont inline (pas de feuille externe)
3. Les largeurs de colonnes sont fixées via `<div style="min-width:Xpx; width:Xpx">` à l'intérieur de chaque `<td>` — méthode la plus fiable dans le renderer d'impression Chromium
4. Une `BrowserWindow` cachée charge le fichier temporaire en `file://`
5. `printToPDF()` est appelé après un délai de 500 ms (rendu complet)
6. Le PDF est ouvert dans le lecteur par défaut

### Impression
1. Même HTML que PDF
2. La fenêtre Chromium est visible
3. `executeJavaScript('window.print()')` ouvre le dialogue OS natif avec aperçu, choix de l'imprimante, copies, marges

### Prix masqués à l'export
Quand `showPrices = false` :
- Les cellules de prix reçoivent `color: transparent` (le texte est invisible mais **le `<div>` garde sa largeur**)
- Les en-têtes de colonnes prix restent noirs et visibles
- Le layout de la table est **strictement identique** avec ou sans prix

---

## Personnalisation des couleurs

Cliquer sur **🎨 Couleurs** dans la barre d'outils pour ouvrir le panneau.  
Chaque type de ligne possède une couleur de fond et une couleur de texte indépendantes.  
Les changements sont appliqués en temps réel et sauvegardés dans le fichier projet.

---

## Largeur des colonnes

Cliquer sur **☰ Colonnes** dans la barre d'outils.

- Les largeurs DQE et BPU sont **complètement indépendantes**
- Les valeurs sont toujours en **pixels concrets** (jamais en auto)
- Modifier une valeur → appliqué immédiatement
- **⚡ Ajuster auto** : mesure le contenu actuel dans le DOM, calcule les largeurs naturelles et les sauvegarde comme valeurs manuelles (action one-shot, pas un mode)
- Les largeurs sont sauvegardées dans le fichier `.devis`

---

## Modules JavaScript

| Fichier | Responsabilité |
|---------|---------------|
| `state.js` | Variables globales partagées. Aucune logique. |
| `constants.js` | Constantes immuables (UNITS, ROMAN, UNIT_WORDS, clés de stockage) |
| `helpers.js` | `esc()`, `da()`, `daNoUnit()`, `num()`, `fmtNum()`, `numToWordsFr()`, `buildBpuSubline()` |
| `numbering.js` | `buildNums()` → `{nums[], letters[]}` — numérotation hiérarchique |
| `visibility.js` | `buildVisibility()` → `Set<index>` des lignes cachées par collapse |
| `totals.js` | `computeTotals()`, `grandTotal()`, `artTotal()`, `recalc()` |
| `render.js` | `render()` — reconstruit tout le tbody. Appelé uniquement pour les changements structurels. |
| `selection.js` | `selectRow()`, `applySelectionClasses()`, `clearSelection()` — **jamais de render()** |
| `sidepanel.js` | `updateSidePanel()` — met à jour le panneau latéral sans render() |
| `rows.js` | `addRow()`, `delSelected()`, `dupSelected()`, `upd()` (debounced), `extractBlock()` |
| `dragdrop.js` | Drag & drop natif HTML5 pour réorganiser les lignes |
| `history.js` | `snapshot()`, `undo()`, `redo()` — 50 étapes max |
| `colors.js` | `syncColorPicker()`, `applyColors()` |
| `prices.js` | `togglePrices()`, `setMode()`, `applyPricesUI()` |
| `ui.js` | `renderHeaderLines()`, `addHeaderLine()`, `updateWorkspaceSize()`, `applyColWidths()`, `applyStoredColWidths()`, `autoFitColWidths()` |
| `search.js` | `handleSearchInput()`, `computeSearchResults()`, `moveSearch()`, `syncSearchUI()` |
| `files.js` | `getSaveData()`, `applyLoadedData()`, `fileSave()`, `buildPrintHTML()`, `doPrint()`, `doExportPdf()` |
| `export.js` | `doExport()` (ExcelJS), `doExportBasic()` (SheetJS fallback), `importExcelBuffer()` |
| `init.js` | `window.onload` — initialisation dans le bon ordre |

---

## Build et distribution

### Configuration `electron-builder` (package.json)

```json
{
  "build": {
    "appId": "com.devis.btp",
    "productName": "Devis BTP",
    "fileAssociations": [{
      "ext": "devis",
      "name": "Projet Devis BTP",
      "icon": "src/assets/icon.ico",
      "role": "Editor"
    }],
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### Assets vendor (hors-ligne)

Tous les assets tiers sont servis localement depuis `src/vendor/` — **aucun CDN, aucune connexion internet requise**.

| Bibliothèque | Version | Usage |
|-------------|---------|-------|
| Bootstrap | 5.3.3 | UI components, layout |
| Bootstrap Icons | 1.11.3 | Icônes vectorielles |
| ExcelJS | 4.4.0 | Export Excel avec styles |
| SheetJS (xlsx) | 0.18.5 | Import Excel + fallback export |

---

## Licence

Projet privé — © 2024–2025 blackscreamer.  
Voir [github.com/blackscreamer/DEVIS-APP](https://github.com/blackscreamer/DEVIS-APP)
