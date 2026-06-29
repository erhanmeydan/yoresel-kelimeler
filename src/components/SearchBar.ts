import { db } from '../config/firebase';
import { searchEntries } from '../services/entries.service';
import { renderEntryCard } from './EntryCard';
import type { Entry } from '../types/models';

const SEARCH_ICON = `
<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="11" cy="11" r="7"></circle>
  <path d="m21 21-4.3-4.3"></path>
</svg>
`;

export function renderSearchBar(container: HTMLElement, onResults: (entries: Entry[]) => void): void {
  container.innerHTML = `
    <div class="search-bar">
      ${SEARCH_ICON}
      <input
        type="search"
        class="search-bar-input"
        placeholder="Kelime, deyim ya da anlam ara&hellip;"
        aria-label="Arama"
      />
      <div class="search-results" hidden></div>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>('.search-bar-input')!;
  const results = container.querySelector<HTMLDivElement>('.search-results')!;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 2) {
        results.hidden = true;
        results.innerHTML = '';
        onResults([]);
        return;
      }
      const result = await searchEntries(db, q);
      if (!result.ok) {
        results.hidden = true;
        onResults([]);
        return;
      }
      if (result.data.length === 0) {
        results.innerHTML = '<div class="search-empty">Eşleşen sözcük bulunamadı.</div>';
        results.hidden = false;
        onResults([]);
        return;
      }
      results.innerHTML = '';
      result.data.forEach((entry) => results.appendChild(renderEntryCard(entry)));
      results.hidden = false;
      onResults(result.data);
      // Close dropdown when a result card is clicked (EnterCard navigates)
      input.addEventListener('click', () => {
        if (!results.hidden && result.data.length > 0) {
          results.hidden = true;
          results.innerHTML = '';
        }
      }, { once: true });
    }, 300);
  });
}