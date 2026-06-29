// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock the regions service BEFORE importing HomePage so module-level imports pick up the mock
vi.mock('../../src/services/regions.service', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/regions.service')>(
    '../../src/services/regions.service',
  );
  return {
    ...actual,
    listTopRegionsByWeeklyEntries: vi.fn(),
  };
});

// Mock firebase config so the HomePage module can import db without side-effects
vi.mock('../../src/config/firebase', () => ({
  db: { __isMockDb: true },
}));

import { listTopRegionsByWeeklyEntries } from '../../src/services/regions.service';
import { renderTopRegionsSection } from '../../src/pages/HomePage';
import type { RegionWeeklyStat } from '../../src/types/models';

const mockedList = vi.mocked(listTopRegionsByWeeklyEntries);

function makeStat(overrides: Partial<RegionWeeklyStat> = {}): RegionWeeklyStat {
  return {
    regionId: 'region-1',
    regionName: 'Konya',
    entryCount: 47,
    sampleEntryId: 'entry-1',
    sampleWord: 'göynük',
    sampleMeaning: 'şenlik, toplantı',
    updatedAt: { seconds: 0, nanoseconds: 0 } as never,
    ...overrides,
  };
}

describe('renderTopRegionsSection', () => {
  let dom: JSDOM;
  let document: Document;
  let slot: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    // HomePage.ts uses the global `document` via direct references.
    // We override the global so the module picks up our JSDOM document.
    (globalThis as { document?: Document }).document = document;
    slot = document.createElement('section');
    slot.id = 'top-regions-slot';
    document.body.appendChild(slot);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders 10 rows with correct hierarchy when service returns data', async () => {
    const stats: RegionWeeklyStat[] = Array.from({ length: 10 }, (_, i) =>
      makeStat({
        regionId: `region-${i + 1}`,
        regionName: `Region ${i + 1}`,
        entryCount: 50 - i,
        sampleWord: `kelime-${i + 1}`,
        sampleMeaning: `anlam-${i + 1}`,
      }),
    );
    mockedList.mockResolvedValue({ ok: true, data: stats });

    const regionNameById = new Map<string, string>();
    await renderTopRegionsSection(slot, regionNameById);

    expect(slot.querySelector('.top-regions-heading')?.textContent).toBe('Bu Hafta En Aktif 10 İl');
    expect(slot.querySelector('.top-regions-subheading')?.textContent).toBe('Son 7 günde en çok katkıda bulunan iller');
    const list = slot.querySelector<HTMLElement>('.top-regions-list');
    expect(list?.getAttribute('aria-label')).toBe('Haftalık il sıralaması');
    expect(slot.querySelectorAll('.top-region-row')).toHaveLength(10);
  });

  it('uses button elements (semantic) for rows with correct ARIA labels', async () => {
    const stats: RegionWeeklyStat[] = [
      makeStat({ regionId: 'region-1', regionName: 'Konya', entryCount: 47 }),
    ];
    mockedList.mockResolvedValue({ ok: true, data: stats });

    await renderTopRegionsSection(slot, new Map());

    const button = slot.querySelector<HTMLButtonElement>('.top-region-row');
    expect(button).toBeTruthy();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Konya, 47 söz. Haritada görmek için tıklayın');
  });

  it('formats rank as 2-digit and shows sample word when present', async () => {
    const stats: RegionWeeklyStat[] = [
      makeStat({ regionName: 'Konya', sampleWord: 'göynük', sampleMeaning: 'şenlik' }),
    ];
    mockedList.mockResolvedValue({ ok: true, data: stats });

    await renderTopRegionsSection(slot, new Map());

    const ranks = slot.querySelectorAll('.top-region-rank');
    expect(ranks[0]?.textContent).toBe('01');
    const sample = slot.querySelector('.top-region-sample');
    expect(sample?.textContent).toBe('"göynük" — şenlik');
  });

  it('hides sample row when sampleWord is empty', async () => {
    const stats: RegionWeeklyStat[] = [
      makeStat({ regionName: 'Konya', sampleWord: '', sampleMeaning: '' }),
    ];
    mockedList.mockResolvedValue({ ok: true, data: stats });

    await renderTopRegionsSection(slot, new Map());

    expect(slot.querySelector('.top-region-sample')).toBeNull();
  });

  it('sizes bar fills proportionally to maxCount', async () => {
    const stats: RegionWeeklyStat[] = [
      makeStat({ regionId: 'r1', regionName: 'A', entryCount: 100 }),
      makeStat({ regionId: 'r2', regionName: 'B', entryCount: 50 }),
      makeStat({ regionId: 'r3', regionName: 'C', entryCount: 25 }),
    ];
    mockedList.mockResolvedValue({ ok: true, data: stats });

    await renderTopRegionsSection(slot, new Map());

    const fills = slot.querySelectorAll<HTMLElement>('.top-region-bar-fill');
    expect(fills[0]?.style.width).toBe('100%');
    expect(fills[1]?.style.width).toBe('50%');
    expect(fills[2]?.style.width).toBe('25%');
  });

  it('renders empty state when service returns data with no entryCount > 0', async () => {
    mockedList.mockResolvedValue({ ok: true, data: [] });

    await renderTopRegionsSection(slot, new Map());

    expect(slot.querySelector('.top-regions-empty')).toBeTruthy();
    expect(slot.querySelector('a[href="/contribute"]')).toBeTruthy();
    expect(slot.querySelector('.top-regions-list')).toBeNull();
  });

  it('removes slot from DOM on error', async () => {
    mockedList.mockResolvedValue({
      ok: false,
      error: { code: 'regions/top-failed', message: 'fail' },
    });

    await renderTopRegionsSection(slot, new Map());

    expect(document.body.contains(slot)).toBe(false);
  });

  it('dispatches top-region-click custom event with regionId when row clicked', async () => {
    const stats: RegionWeeklyStat[] = [
      makeStat({ regionId: 'region-42', regionName: 'Konya', entryCount: 10 }),
    ];
    mockedList.mockResolvedValue({ ok: true, data: stats });

    let detail: { regionId: string; regionName: string } | null = null;
    const handler = (e: Event) => {
      detail = (e as CustomEvent<{ regionId: string; regionName: string }>).detail;
    };
    document.addEventListener('top-region-click', handler);

    await renderTopRegionsSection(slot, new Map());
    const button = slot.querySelector<HTMLButtonElement>('.top-region-row');
    button?.click();

    document.removeEventListener('top-region-click', handler);

    expect(detail).toEqual({ regionId: 'region-42', regionName: 'Konya' });
  });
});
