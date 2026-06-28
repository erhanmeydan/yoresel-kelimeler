import { db } from '../config/firebase';
import { listRegions } from '../services/regions.service';
import { listEntriesByRegion } from '../services/entries.service';
import { store } from '../store/store';
import { MapView } from '../components/MapView';
import { renderEntryCard } from '../components/EntryCard';
import { renderSearchBar } from '../components/SearchBar';
import type { Region, Entry } from '../types/models';

export async function renderHomePage(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <main class="home-page">
      <section class="map-section"><div id="map" class="map"></div></section>
      <aside class="entries-panel">
        <h2 id="panel-title">Türkiye Yöresel Kelimeleri</h2>
        <p id="panel-subtitle">Bir ile tıklayarak o yörenin kelimelerini görün.</p>
        <div id="entries-list" class="entries-list"></div>
      </aside>
    </main>
  `;

  container.querySelector<HTMLElement>('.entries-panel')!.insertAdjacentHTML(
    'afterbegin',
    '<div id="search-slot" style="margin-bottom: var(--space-4)"></div>'
  );
  renderSearchBar(
    document.getElementById('search-slot')!,
    (entries) => {
      if (entries.length === 0) {
        // boş state veya bölge listesi gösterilebilir
      }
    }
  );

  const mapEl = container.querySelector<HTMLDivElement>('#map')!;
  const listEl = container.querySelector<HTMLDivElement>('#entries-list')!;
  const titleEl = container.querySelector<HTMLHeadingElement>('#panel-title')!;
  const subtitleEl = container.querySelector<HTMLParagraphElement>('#panel-subtitle')!;

  const mapView = new MapView(mapEl, {
    onRegionClick: (region) => handleRegionClick(region),
  });

  const regionsResult = await listRegions(db);
  if (regionsResult.ok) {
    mapView.setRegions(regionsResult.data);
  }

  async function handleRegionClick(region: Region): Promise<void> {
    store.setSelectedRegion(region);
    mapView.highlightRegion(region.id);
    titleEl.textContent = region.name;
    subtitleEl.textContent = `${region.parentRegion} Bölgesi`;
    listEl.innerHTML = '<p class="loading">Yükleniyor...</p>';

    const result = await listEntriesByRegion(db, region.id);
    if (result.ok) {
      renderEntries(result.data, listEl);
    } else {
      listEl.innerHTML = `<p class="error">${result.error.message}</p>`;
    }
  }

  function renderEntries(entries: Entry[], target: HTMLElement): void {
    if (entries.length === 0) {
      target.innerHTML = '<p class="empty">Bu bölgeden henüz kayıt yok. İlk siz ekleyin!</p>';
      return;
    }
    target.innerHTML = '';
    for (const entry of entries) target.appendChild(renderEntryCard(entry));
  }
}