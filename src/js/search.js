/**
 * search.js - Recherche simple dans les chapitres, sous-chapitres et articles.
 */

function rowSearchText(r) {
  return [
    r.desig,
    r.bpu_desig,
    r.unite,
    r.bpu_unite,
    r.qty,
    r.pu,
    r.bpu_pu
  ].filter(Boolean).join(' ').toLowerCase();
}

function computeSearchResults() {
  const q = (searchQuery || '').trim().toLowerCase();
  if (!q) {
    searchResults = [];
    searchIndex = -1;
    return;
  }
  searchResults = rows.filter(r => rowSearchText(r).includes(q)).map(r => r.id);
  if (!searchResults.length) searchIndex = -1;
  else if (searchIndex < 0 || searchIndex >= searchResults.length) searchIndex = 0;
}

function getSearchRowClass(id) {
  if (!searchResults.includes(id)) return '';
  return searchResults[searchIndex] === id ? ' search-hit-active' : ' search-hit';
}

function syncSearchUI() {
  const input = document.getElementById('search-input');
  const count = document.getElementById('search-count');
  const clear = document.getElementById('search-clear');
  const wrap  = document.getElementById('search-wrap');
  const prev  = document.getElementById('search-prev');
  const next  = document.getElementById('search-next');

  if (input && input.value !== searchQuery) input.value = searchQuery;

  // Clear button
  if (clear) clear.style.display = searchQuery ? 'flex' : 'none';

  // Prev/next buttons — show when there are results
  if (prev) prev.style.display = searchResults.length > 1 ? 'flex' : 'none';
  if (next) next.style.display = searchResults.length > 1 ? 'flex' : 'none';

  // Result counter
  if (count) {
    if (searchResults.length) {
      count.textContent = `${searchIndex + 1}/${searchResults.length}`;
    } else {
      count.textContent = searchQuery ? '0' : '';
    }
  }

  // No-match visual state
  if (wrap) {
    const noMatch = !!searchQuery && searchResults.length === 0;
    wrap.classList.toggle('no-match', noMatch);
  }
}

function focusSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.focus();
  input.select();
}

function scrollToSearchResult() {
  if (searchIndex < 0 || !searchResults.length) return;
  const tr = document.getElementById('ro-' + searchResults[searchIndex]);
  if (tr) tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function handleSearchInput(val) {
  searchQuery = val || '';
  computeSearchResults();
  render();
  syncSearchUI();
  scrollToSearchResult();
}

function moveSearch(step) {
  if (!searchResults.length) return;
  searchIndex = (searchIndex + step + searchResults.length) % searchResults.length;
  render();
  syncSearchUI();
  scrollToSearchResult();
}

function handleSearchKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    moveSearch(e.shiftKey ? -1 : 1);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    clearSearch();
  }
}

function clearSearch() {
  searchQuery = '';
  searchResults = [];
  searchIndex = -1;
  render();
  syncSearchUI();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    focusSearch();
  }
});
