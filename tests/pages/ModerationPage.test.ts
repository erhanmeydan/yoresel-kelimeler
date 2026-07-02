// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/config/firebase', () => ({
  auth: { currentUser: { uid: 'mod1' } },
  db: {},
}));
vi.mock('../../src/services/auth.service', () => ({
  ensureAuthReady: vi.fn().mockResolvedValue({ uid: 'mod1' }),
  getProfile: vi.fn().mockResolvedValue({ ok: true, data: { uid: 'mod1', role: 'moderator' } }),
}));
vi.mock('../../src/components/admin/tabs/ReportsTab', () => ({
  renderReportsTab: vi.fn(),
}));
vi.mock('../../src/components/admin/tabs/CommentsTab', () => ({
  renderCommentsTab: vi.fn(),
}));
vi.mock('../../src/components/admin/tabs/EntriesTab', () => ({
  renderEntriesTab: vi.fn(),
}));
vi.mock('../../src/components/admin/tabs/UsersTab', () => ({
  renderUsersTab: vi.fn(),
}));
vi.mock('../../src/components/admin/tabs/StatsTab', () => ({
  renderStatsTab: vi.fn(),
  MODERATION_SWITCH_TAB_EVENT: 'moderation:switch-tab',
}));

function resetUrl(search = ''): void {
  window.history.replaceState({}, '', '/' + (search.startsWith('?') ? search : (search ? `?${search}` : '')));
}

describe('ModerationPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    resetUrl('');
  });

  it('renders 5 tabs', async () => {
    const { renderModerationPage } = await import('../../src/pages/ModerationPage');
    await renderModerationPage(document.getElementById('root')!);
    const tabs = document.querySelectorAll('.tab-btn');
    expect(tabs.length).toBe(5);
    expect(tabs[0]!.textContent).toContain('Raporlar');
    expect(tabs[1]!.textContent).toContain('Yorumlar');
    expect(tabs[2]!.textContent).toContain('Maddeler');
    expect(tabs[3]!.textContent).toContain('Kullanıcılar');
    expect(tabs[4]!.textContent).toContain('İstatistikler');
  });

  it('loads tab from URL query param', async () => {
    resetUrl('?tab=entries');
    const { renderModerationPage } = await import('../../src/pages/ModerationPage');
    const { renderEntriesTab } = await import('../../src/components/admin/tabs/EntriesTab');
    await renderModerationPage(document.getElementById('root')!);
    expect(renderEntriesTab).toHaveBeenCalled();
  });

  it('updates URL when tab clicked', async () => {
    const { renderModerationPage } = await import('../../src/pages/ModerationPage');
    await renderModerationPage(document.getElementById('root')!);
    const usersTab = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent?.includes('Kullanıcılar')) as HTMLButtonElement;
    usersTab.click();
    await new Promise(r => setTimeout(r, 50));
    expect(window.location.search).toContain('tab=users');
  });

  it('switches tab and renders when moderation:switch-tab event is dispatched', async () => {
    resetUrl('?tab=stats');
    const { renderModerationPage } = await import('../../src/pages/ModerationPage');
    const { renderReportsTab } = await import('../../src/components/admin/tabs/ReportsTab');
    await renderModerationPage(document.getElementById('root')!);
    vi.mocked(renderReportsTab).mockClear();

    window.dispatchEvent(new CustomEvent('moderation:switch-tab', { detail: { tab: 'reports' } }));
    await new Promise(r => setTimeout(r, 50));

    expect(renderReportsTab).toHaveBeenCalledTimes(1);
    expect(window.location.search).toContain('tab=reports');
    const activeTab = document.querySelector('.tab-btn.active');
    expect(activeTab?.textContent).toContain('Raporlar');
  });

  it('ignores moderation:switch-tab events with unknown tab names', async () => {
    resetUrl('?tab=stats');
    const { renderModerationPage } = await import('../../src/pages/ModerationPage');
    const { renderReportsTab } = await import('../../src/components/admin/tabs/ReportsTab');
    await renderModerationPage(document.getElementById('root')!);
    vi.mocked(renderReportsTab).mockClear();

    window.dispatchEvent(new CustomEvent('moderation:switch-tab', { detail: { tab: 'banana' } }));
    await new Promise(r => setTimeout(r, 50));

    expect(renderReportsTab).not.toHaveBeenCalled();
    expect(window.location.search).toContain('tab=stats');
  });
});