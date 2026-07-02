// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderEntriesTab } from '../../../../src/components/admin/tabs/EntriesTab';

// Mock firebase config so the module-level `db` import does not call initializeApp
vi.mock('../../../../src/config/firebase', () => ({
  db: { __isMockDb: true },
}));

// Mock the entries moderation service module
vi.mock('../../../../src/services/admin/entriesModeration.service', () => ({
  listEntries: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [], hasMore: false },
  }),
  softDeleteEntry: vi.fn(),
  restoreEntry: vi.fn(),
}));

describe('EntriesTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.clearAllMocks();
  });

  it('renders ListView with entry columns (header "Kelime")', async () => {
    await renderEntriesTab(document.getElementById('root')!);
    expect(document.querySelector('.list-view__header th')?.textContent).toBe('Kelime');
  });

  it('renders all expected column headers in order', async () => {
    await renderEntriesTab(document.getElementById('root')!);
    const headers = Array.from(document.querySelectorAll('.list-view__header th'))
      .map(th => th.textContent);
    expect(headers).toEqual(['Kelime', 'Anlam', 'İl', 'Tarih', 'Durum', 'Aksiyon']);
  });

  it('renders the status filter as a select with 3 options', async () => {
    await renderEntriesTab(document.getElementById('root')!);
    const selects = document.querySelectorAll<HTMLSelectElement>('.list-view__filter select');
    expect(selects.length).toBe(1);
    const options = Array.from(selects[0]!.options).map(o => o.text);
    expect(options).toEqual(['Hepsi', 'Aktif', 'Silinmiş']);
  });

  it('renders the search text filter', async () => {
    await renderEntriesTab(document.getElementById('root')!);
    const input = document.querySelector<HTMLInputElement>('.list-view__filter input');
    expect(input).toBeTruthy();
    expect(input?.placeholder).toBe('Kelime / İl');
  });

  it('shows empty state when listEntries returns no items', async () => {
    await renderEntriesTab(document.getElementById('root')!);
    const empty = document.querySelector('.list-view__empty');
    expect(empty?.textContent).toBe('Hiç entry yok.');
  });

  it('calls listEntries with empty filter object when "Hepsi" filter is active', async () => {
    const { listEntries } = await import('../../../../src/services/admin/entriesModeration.service');
    await renderEntriesTab(document.getElementById('root')!);
    expect(listEntries).toHaveBeenCalled();
    const firstCallArgs = vi.mocked(listEntries).mock.calls[0];
    expect(firstCallArgs?.[1]).toEqual({});
  });
});