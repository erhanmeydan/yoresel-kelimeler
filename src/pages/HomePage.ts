import { db } from '../config/firebase';
import { listRegions, listTopRegionsByWeeklyEntries } from '../services/regions.service';
import { listEntriesByRegion, listRecentEntries } from '../services/entries.service';
import { store } from '../store/store';
import { MapView } from '../components/MapView';
import { renderEntryCard } from '../components/EntryCard';
import { renderSearchBar } from '../components/SearchBar';
import { ENTRY_TYPE_LABELS } from '../config/constants';
import type { Region, Entry, RegionWeeklyStat } from '../types/models';

function renderHero(regionCount: number): string {
  return `
    <section class="hero" aria-label="Proje tanıtımı">
      <div class="hero-inner">
        <div>
          <h1 class="hero-title">
            Türkiye'nin <em>dili</em>, haritada.
          </h1>
          <p class="hero-lede">
            81 ilin yöresel kelimelerini, deyimlerini ve atasözlerini topluluk katkısıyla büyüyen
            kültürel arşiv. Bir ile tıklayın, o yörenin sesini dinleyin.
          </p>
        </div>
        <dl class="hero-stats" aria-label="İstatistikler">
          <div class="stat">
            <dt class="stat-label">İl</dt>
            <dd class="stat-value">${regionCount}</dd>
          </div>
          <div class="stat">
            <dt class="stat-label">Katkı</dt>
            <dd class="stat-value">açık</dd>
          </div>
          <div class="stat">
            <dt class="stat-label">Kapsam</dt>
            <dd class="stat-value">7</dd>
          </div>
        </dl>
      </div>
    </section>
  `;
}

function renderPanelEmpty(): string {
  return `
    <div class="panel-empty">
      <div class="panel-empty-mark" aria-hidden="true">&ldquo;</div>
      <h2 class="panel-empty-title">Henüz kayıt yok</h2>
      <p class="panel-empty-text">
        Bu bölgeden henüz sözcük eklenmemiş. İlk siz ekleyebilirsiniz &mdash;
        yörenizden bir kelime, bir deyim, bir atasözü.
      </p>
      <a class="btn btn-primary" href="/contribute">Sözcük ekle</a>
    </div>
  `;
}

function renderWelcomePanel(): string {
  return `
    <div class="panel-empty">
      <div class="panel-empty-mark" aria-hidden="true">&rarr;</div>
      <h2 class="panel-empty-title">Bir il seçin</h2>
      <p class="panel-empty-text">
        Haritadan bir ile tıklayın ya da aşağıdan arayın. O yörenin sözcükleri burada belirsin.
      </p>
    </div>
  `;
}

export async function renderHomePage(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <main class="home-page">
      ${renderHero(81)}
      <div class="map-and-panel">
        <section class="map-section" aria-label="Türkiye haritası">
          <div id="map" class="map"></div>
          <div class="map-hint" aria-hidden="true"><span>Bir ile tıklayarak başlayın</span></div>
        </section>
        <aside class="entries-panel" aria-live="polite">
          <div class="panel-header">
            <h2 id="panel-title" class="panel-title">Türkiye Yöresel Sözlüğü</h2>
            <p id="panel-subtitle" class="panel-subtitle">
              <strong>81 il</strong> &middot; Topluluk katkısıyla büyüyor
            </p>
          </div>
          <div id="search-slot"></div>
          <div id="entries-list" class="entries-list"></div>
        </aside>
      </div>
      <section id="recent-slot" class="recent-section"></section>
    </main>
  `;

  renderSearchBar(
    document.getElementById('search-slot')!,
    (_entries: Entry[]) => {
      /* search results surface here in future */
    }
  );

  const mapEl = container.querySelector<HTMLDivElement>('#map')!;
  const listEl = container.querySelector<HTMLDivElement>('#entries-list')!;
  const titleEl = container.querySelector<HTMLHeadingElement>('#panel-title')!;
  const subtitleEl = container.querySelector<HTMLParagraphElement>('#panel-subtitle')!;

  const mapView = new MapView(mapEl, {
    onRegionClick: (region) => void handleRegionClick(region),
  });

  const regionsResult = await listRegions(db);
  let regions: Region[] = [];

  if (regionsResult.ok) {
    regions = regionsResult.data;
    mapView.setRegions(regions);
  }

  const regionNameById = new Map(regions.map((r) => [r.id, r.name]));

  // Update hero "İl" stat with real count
  const ilStat = container.querySelector<HTMLElement>('.hero-stats .stat:first-child .stat-value');
  if (ilStat) ilStat.textContent = String(regions.length || 81);

  async function handleRegionClick(region: Region): Promise<void> {
    store.setSelectedRegion(region);
    mapView.highlightRegion(region.id);
    titleEl.textContent = region.name;
    // Safe DOM construction — never use innerHTML with server/user data
    subtitleEl.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = region.parentRegion;
    subtitleEl.append(strong, document.createTextNode(' Bölgesi'));

    listEl.innerHTML = '<p class="loading">Yükleniyor&hellip;</p>';

    const result = await listEntriesByRegion(db, region.id);
    if (!result.ok) {
      // Safe: build error element with textContent
      listEl.replaceChildren();
      const errP = document.createElement('p');
      errP.className = 'error';
      errP.textContent = result.error.message;
      listEl.appendChild(errP);
      return;
    }
    renderEntries(result.data, listEl);
  }

  function renderEntries(entries: Entry[], target: HTMLElement): void {
    if (entries.length === 0) {
      target.innerHTML = renderPanelEmpty();
      return;
    }
    target.innerHTML = '';
    for (const entry of entries) {
      target.appendChild(renderEntryCard(entry, regionNameById.get(entry.regionId)));
    }
  }

  if (regions.length === 0) {
    listEl.innerHTML = renderWelcomePanel();
  }

  // Son Eklenenler section
  const recentSlot = container.querySelector<HTMLElement>('#recent-slot')!;
  void renderRecentSection(recentSlot, regionNameById);
}

async function renderRecentSection(
  slot: HTMLElement, regionNameById: Map<string, string>,
): Promise<void> {
  const result = await listRecentEntries(db, 10);
  if (!result.ok) {
    console.warn('[recent-entries]', result.error.code, result.error.message);
    slot.remove();
    return;
  }
  if (result.data.length === 0) {
    slot.remove();
    return;
  }

  const heading = document.createElement('h2');
  heading.className = 'recent-heading';
  heading.textContent = 'Son Eklenenler';

  const grid = document.createElement('div');
  grid.className = 'recent-grid';
  grid.setAttribute('aria-label', 'Son eklenen 10 sözcük');

  for (const entry of result.data) {
    grid.appendChild(renderRecentCard(entry, regionNameById.get(entry.regionId)));
  }

  slot.replaceChildren(heading, grid);
}

function renderRecentCard(entry: Entry, regionName: string | undefined): HTMLElement {
  const card = document.createElement('a');
  card.className = 'recent-card';
  card.href = `/entry/${encodeURIComponent(entry.slug || entry.id)}`;

  const typeLabel = document.createElement('span');
  typeLabel.className = 'recent-card-type';
  typeLabel.textContent = ENTRY_TYPE_LABELS[entry.type];

  const word = document.createElement('h3');
  word.className = 'recent-card-word';
  word.textContent = entry.word;

  const meaning = document.createElement('p');
  meaning.className = 'recent-card-meaning';
  meaning.textContent = entry.meaning;

  const meta = document.createElement('span');
  meta.className = 'recent-card-region';
  meta.textContent = regionName ?? entry.regionId;

  card.append(typeLabel, word, meaning, meta);
  return card;
}

export async function renderTopRegionsSection(
  slot: HTMLElement,
  regionNameById: Map<string, string>,
): Promise<void> {
  const result = await listTopRegionsByWeeklyEntries(db, 10);
  if (!result.ok) {
    console.warn('[top-regions]', result.error.code, result.error.message);
    slot.remove();
    return;
  }

  const stats = result.data.filter((s) => s.entryCount > 0);

  if (stats.length === 0) {
    slot.innerHTML = `
      <h2 class="top-regions-heading">Bu Hafta En Aktif 10 İl</h2>
      <div class="top-regions-empty">
        <p>Bu hafta henüz kimse katkıda bulunmadı. İlk siz olun!</p>
        <a class="btn btn-primary" href="/contribute">Katkıda bulun</a>
      </div>
    `;
    return;
  }

  const heading = document.createElement('h2');
  heading.className = 'top-regions-heading';
  heading.textContent = 'Bu Hafta En Aktif 10 İl';

  const subheading = document.createElement('p');
  subheading.className = 'top-regions-subheading';
  subheading.textContent = 'Son 7 günde en çok katkıda bulunan iller';

  const list = document.createElement('div');
  list.className = 'top-regions-list';
  list.setAttribute('aria-label', 'Haftalık il sıralaması');

  const maxCount = stats[0]?.entryCount ?? 1;

  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    if (!stat) continue;
    list.appendChild(renderTopRegionRow(stat, i + 1, maxCount));
  }

  slot.replaceChildren(heading, subheading, list);
}

function renderTopRegionRow(
  stat: RegionWeeklyStat,
  rank: number,
  maxCount: number,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'top-region-row';
  button.setAttribute(
    'aria-label',
    `${stat.regionName}, ${stat.entryCount} söz. Haritada görmek için tıklayın`,
  );

  const rankEl = document.createElement('span');
  rankEl.className = 'top-region-rank';
  rankEl.textContent = rank.toString().padStart(2, '0');

  const info = document.createElement('div');
  info.className = 'top-region-info';

  const name = document.createElement('span');
  name.className = 'top-region-name';
  name.textContent = stat.regionName;
  info.appendChild(name);

  if (stat.sampleWord) {
    const sample = document.createElement('span');
    sample.className = 'top-region-sample';
    sample.textContent = `"${stat.sampleWord}"${stat.sampleMeaning ? ` — ${stat.sampleMeaning}` : ''}`;
    info.appendChild(sample);
  }

  const statBar = document.createElement('div');
  statBar.className = 'top-region-stat';

  const bar = document.createElement('div');
  bar.className = 'top-region-bar';
  bar.setAttribute('aria-hidden', 'true');
  const barFill = document.createElement('div');
  barFill.className = 'top-region-bar-fill';
  const pct = maxCount > 0 ? (stat.entryCount / maxCount) * 100 : 0;
  barFill.style.width = `${pct}%`;
  bar.appendChild(barFill);

  const count = document.createElement('span');
  count.className = 'top-region-count';
  count.textContent = `${stat.entryCount} söz`;

  statBar.append(bar, count);

  button.append(rankEl, info, statBar);

  // Click handler — dispatch to home page's handleRegionClick
  button.addEventListener('click', () => {
    const regionId = stat.regionId;
    // Note: handleRegionClick closure'ı renderHomePage içinde tanımlı
    // Bu fonksiyon dışarıdan çağrılamaz; bunun yerine regionId'yi data attribute ile aktarıp
    // HomePage'te delegate edeceğiz. Aşağıdaki Task 7'de detaylanıyor.
    document.dispatchEvent(
      new CustomEvent('top-region-click', {
        detail: { regionId, regionName: stat.regionName },
      }),
    );
  });

  return button;
}