import { db } from '../config/firebase';
import { searchEntries } from '../services/entries.service';
import { renderEntryCard } from './EntryCard';
import type { Entry } from '../types/models';

export function renderSearchBar(container: HTMLElement, onResults: (entries: Entry[]) => void): void {
  container.innerHTML = `
    <div class="search-bar">
      <input type="search" placeholder="Kelime veya anlam ara..." aria-label="Arama" />
      <div class="search-results" hidden></div>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>('input')!;
  const results = container.querySelector<HTMLDivElement>('.search-results')!;
  let debounceTimer: number | undefined;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 2) {
        results.hidden = true;
        onResults([]);
        return;
      }
      const result = await searchEntries(db, q);
      if (result.ok) {
        results.innerHTML = '';
        result.data.forEach((entry) => results.appendChild(renderEntryCard(entry)));
        results.hidden = result.data.length === 0;
        onResults(result.data);
      } else {
        results.hidden = true;
      }
    }, 300);
  });
}