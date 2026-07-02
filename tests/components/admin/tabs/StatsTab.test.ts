// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderStatsTab } from '../../../../src/components/admin/tabs/StatsTab';

// Mock firebase config so the module-level `db` import does not call initializeApp
vi.mock('../../../../src/config/firebase', () => ({
  db: { __isMockDb: true },
}));

// Mock reports service (used for open-reports count). The fixture count is the
// only thing StatsTab cares about, so plain objects with `id` are enough.
vi.mock('../../../../src/services/admin/reports.service', () => ({
  listReports: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }], hasMore: false },
  }),
}));

// Mock admin.service (used for the other two counters)
vi.mock('../../../../src/services/admin.service', () => ({
  getAdminStats: vi.fn().mockResolvedValue({
    ok: true,
    data: { reportsOpen: 0, commentsDeletedToday: 7, blockedUsersCount: 4 },
  }),
}));

function makeItems(n: number): Array<{ id: string }> {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}` } as { id: string }));
}

describe('StatsTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.clearAllMocks();
  });

  it('renders three stat widgets in order', async () => {
    await renderStatsTab(document.getElementById('root')!);
    const widgets = document.querySelectorAll('.stat-widget');
    expect(widgets.length).toBe(3);
    expect(widgets[0]!.querySelector('.stat-label')?.textContent).toBe('Açık Raporlar');
    expect(widgets[1]!.querySelector('.stat-label')?.textContent).toBe('Bugün Silinen Yorum');
    expect(widgets[2]!.querySelector('.stat-label')?.textContent).toBe('Engellenen Kullanıcı');
  });

  it('shows open-reports count from listReports(db, { status: "open" })', async () => {
    const { listReports } = await import('../../../../src/services/admin/reports.service');
    vi.mocked(listReports).mockResolvedValueOnce({
      ok: true,
      data: { items: makeItems(2) as never, hasMore: false },
    });
    await renderStatsTab(document.getElementById('root')!);
    expect(listReports).toHaveBeenCalledWith(expect.anything(), { status: 'open' });
    const openReportsWidget = document.querySelectorAll('.stat-widget')[0]!;
    expect(openReportsWidget.querySelector('.stat-value')?.textContent).toBe('2');
  });

  it('falls back to 0 when listReports fails', async () => {
    const { listReports } = await import('../../../../src/services/admin/reports.service');
    vi.mocked(listReports).mockResolvedValueOnce({
      ok: false,
      error: { code: 'reports/list-failed', message: 'Raporlar yüklenemedi.' },
    });
    await renderStatsTab(document.getElementById('root')!);
    const openReportsWidget = document.querySelectorAll('.stat-widget')[0]!;
    expect(openReportsWidget.querySelector('.stat-value')?.textContent).toBe('0');
  });

  it('renders "Raporları Gör" button on the open-reports widget that dispatches moderation:switch-tab', async () => {
    const handler = vi.fn();
    window.addEventListener('moderation:switch-tab', handler as EventListener);
    try {
      await renderStatsTab(document.getElementById('root')!);
      const button = document.querySelector<HTMLButtonElement>('.stat-widget__link');
      expect(button).toBeTruthy();
      expect(button?.textContent).toContain('Raporları Gör');
      button?.click();
      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]?.[0] as CustomEvent<{ tab: string }>;
      expect(event.detail.tab).toBe('reports');
    } finally {
      window.removeEventListener('moderation:switch-tab', handler as EventListener);
    }
  });
});