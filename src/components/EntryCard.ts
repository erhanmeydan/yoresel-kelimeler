import type { Entry } from '../types/models';
import { ENTRY_TYPE_LABELS } from '../config/constants';

export function renderEntryCard(entry: Entry): HTMLElement {
  const card = document.createElement('article');
  card.className = 'entry-card';
  card.innerHTML = `
    <header>
      <span class="entry-type">${ENTRY_TYPE_LABELS[entry.type]}</span>
      <h3 class="entry-word"></h3>
    </header>
    <p class="entry-meaning"></p>
    <footer>
      <span class="entry-region"></span>
      <span class="entry-likes">♥ ${entry.likeCount}</span>
    </footer>
  `;
  card.querySelector('.entry-word')!.textContent = entry.word;
  card.querySelector('.entry-meaning')!.textContent = entry.meaning;
  card.querySelector('.entry-region')!.textContent = entry.regionId;
  return card;
}