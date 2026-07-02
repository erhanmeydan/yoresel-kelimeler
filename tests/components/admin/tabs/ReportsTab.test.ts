// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderReportsTab } from '../../../../src/components/admin/tabs/ReportsTab';

// Mock firebase config so the module-level `db` import does not call initializeApp
vi.mock('../../../../src/config/firebase', () => ({
  auth: { __isMockAuth: true, currentUser: { uid: 'mod-1' } },
  db: { __isMockDb: true },
}));

// Mock the reports service module
vi.mock('../../../../src/services/admin/reports.service', () => ({
  listReports: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [], hasMore: false },
  }),
  resolveReport: vi.fn(),
  dismissReport: vi.fn(),
}));

describe('ReportsTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.clearAllMocks();
  });

  it('renders report columns', async () => {
    await renderReportsTab(document.getElementById('root')!);
    expect(document.querySelector('.list-view__header th')?.textContent).toBe('İçerik');
  });

  it('renders all expected column headers in order', async () => {
    await renderReportsTab(document.getElementById('root')!);
    const headers = Array.from(document.querySelectorAll('.list-view__header th'))
      .map(th => th.textContent);
    expect(headers).toEqual(['İçerik', 'Sebep', 'Bildiren', 'Tarih', 'Durum', 'Aksiyon']);
  });

  it('renders the status filter as a select with 3 options (no q filter)', async () => {
    await renderReportsTab(document.getElementById('root')!);
    const selects = document.querySelectorAll<HTMLSelectElement>('.list-view__filter select');
    expect(selects.length).toBe(1);
    const options = Array.from(selects[0]!.options).map(o => o.text);
    expect(options).toEqual(['Açık', 'Çözüldü', 'Reddedildi']);
  });

  it('does NOT render a text search filter (per brief)', async () => {
    await renderReportsTab(document.getElementById('root')!);
    const input = document.querySelector<HTMLInputElement>('.list-view__filter input');
    expect(input).toBeNull();
  });

  it('shows empty state when listReports returns no items', async () => {
    await renderReportsTab(document.getElementById('root')!);
    const empty = document.querySelector('.list-view__empty');
    expect(empty?.textContent).toBe('Rapor yok.');
  });

  it('calls listReports with status=undefined when "Açık" filter is active (first option)', async () => {
    const { listReports } = await import('../../../../src/services/admin/reports.service');
    await renderReportsTab(document.getElementById('root')!);
    expect(listReports).toHaveBeenCalled();
    const firstCallArgs = vi.mocked(listReports).mock.calls[0];
    // first arg: db, second: { status: 'open' | undefined }
    expect(firstCallArgs?.[1]).toEqual({ status: 'open' });
  });
});