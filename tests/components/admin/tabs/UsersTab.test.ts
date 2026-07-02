// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderUsersTab } from '../../../../src/components/admin/tabs/UsersTab';

// Mock firebase config so the module-level `db` import does not call initializeApp
vi.mock('../../../../src/config/firebase', () => ({
  db: { __isMockDb: true },
}));

// Mock adminUsers.service (listBlockedUsers)
vi.mock('../../../../src/services/adminUsers.service', () => ({
  listBlockedUsers: vi.fn().mockResolvedValue({
    ok: true,
    data: [],
  }),
}));

// Mock admin.service (blockUser / unblockUser)
vi.mock('../../../../src/services/admin.service', () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));

// Mock firestore primitives used directly in UsersTab.ts
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

describe('UsersTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.clearAllMocks();
  });

  it('renders ListView with user columns (header "Kullanıcı")', async () => {
    await renderUsersTab(document.getElementById('root')!);
    expect(document.querySelector('.list-view__header th')?.textContent).toBe('Kullanıcı');
  });

  it('renders all expected column headers in order', async () => {
    await renderUsersTab(document.getElementById('root')!);
    const headers = Array.from(document.querySelectorAll('.list-view__header th'))
      .map(th => th.textContent);
    expect(headers).toEqual(['Kullanıcı', 'E-posta', 'Rol', 'Katkılar', 'Durum', 'Aksiyon']);
  });

  it('renders the status filter as a select with 3 options', async () => {
    await renderUsersTab(document.getElementById('root')!);
    const selects = document.querySelectorAll<HTMLSelectElement>('.list-view__filter select');
    expect(selects.length).toBe(1);
    const options = Array.from(selects[0]!.options).map(o => o.text);
    expect(options).toEqual(['Hepsi', 'Aktif', 'Engellenmiş']);
  });

  it('renders the text search filter', async () => {
    await renderUsersTab(document.getElementById('root')!);
    const input = document.querySelector<HTMLInputElement>('.list-view__filter input');
    expect(input).toBeTruthy();
    expect(input?.placeholder).toBe('Ara');
  });

  it('shows empty state when no users exist', async () => {
    await renderUsersTab(document.getElementById('root')!);
    const empty = document.querySelector('.list-view__empty');
    expect(empty?.textContent).toBe('Hiç kullanıcı yok.');
  });
});