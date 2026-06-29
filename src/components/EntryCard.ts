import type { Entry } from '../types/models';
import { ENTRY_TYPE_LABELS } from '../config/constants';
import { navigate } from '../utils/navigate';

export function renderEntryCard(entry: Entry, regionName?: string): HTMLElement {
  const card = document.createElement('article');
  card.className = 'entry-card';
  card.dataset.type = entry.type;
  card.tabIndex = 0;
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${ENTRY_TYPE_LABELS[entry.type]}: ${entry.word}`);

  const heart = '♥';

  card.innerHTML = `
    <span class="entry-type">${ENTRY_TYPE_LABELS[entry.type]}</span>
    <h3 class="entry-word"></h3>
    <p class="entry-meaning"></p>
    <footer>
      <span class="entry-region"></span>
      <span class="entry-likes" aria-label="${entry.likeCount} beğeni">${heart} ${entry.likeCount}</span>
    </footer>
  `;

  card.querySelector('.entry-word')!.textContent = entry.word;
  card.querySelector('.entry-meaning')!.textContent = entry.meaning;
  card.querySelector('.entry-region')!.textContent = regionName ?? entry.regionId;

  const slug = entry.slug || entry.id;
  card.addEventListener('click', () => {
    navigate(`/entry/${slug}`);
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/entry/${slug}`);
    }
  });

  return card;
}