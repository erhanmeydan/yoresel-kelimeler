// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderCommentsTab } from '../../../../src/components/admin/tabs/CommentsTab';

// Mock firebase config so the module-level `db` import does not call initializeApp
vi.mock('../../../../src/config/firebase', () => ({
  db: { __isMockDb: true },
}));

// Mock the admin service module — brief signature:
// listAllComments returns ServiceResult<{ items, hasMore, lastVisible }>
vi.mock('../../../../src/services/admin/admin.service', () => ({
  listAllComments: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [], hasMore: false },
  }),
  deleteComment: vi.fn(),
  restoreComment: vi.fn(),
}));

describe('CommentsTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.clearAllMocks();
  });

  it('renders ListView with comment columns (header "Yazar")', async () => {
    await renderCommentsTab(document.getElementById('root')!);
    expect(document.querySelector('.list-view__header th')?.textContent).toBe('Yazar');
  });

  it('renders all expected column headers in order', async () => {
    await renderCommentsTab(document.getElementById('root')!);
    const headers = Array.from(document.querySelectorAll('.list-view__header th'))
      .map(th => th.textContent);
    expect(headers).toEqual(['Yazar', 'Yorum', 'Tarih', 'Durum', 'Aksiyon']);
  });

  it('renders the status filter as a select with 3 options', async () => {
    await renderCommentsTab(document.getElementById('root')!);
    const selects = document.querySelectorAll<HTMLSelectElement>('.list-view__filter select');
    expect(selects.length).toBe(1);
    const options = Array.from(selects[0]!.options).map(o => o.text);
    expect(options).toEqual(['Hepsi', 'Aktif', 'Silinmiş']);
  });

  it('renders the text search filter', async () => {
    await renderCommentsTab(document.getElementById('root')!);
    const input = document.querySelector<HTMLInputElement>('.list-view__filter input');
    expect(input).toBeTruthy();
    expect(input?.placeholder).toBe('Ara');
  });

  it('shows empty state when listAllComments returns no items', async () => {
    await renderCommentsTab(document.getElementById('root')!);
    const empty = document.querySelector('.list-view__empty');
    expect(empty?.textContent).toBe('Hiç yorum yok.');
  });

  it('calls listAllComments with empty filters object when "Hepsi" filter is active', async () => {
    const { listAllComments } = await import('../../../../src/services/admin/admin.service');
    await renderCommentsTab(document.getElementById('root')!);
    expect(listAllComments).toHaveBeenCalled();
    const firstCallArgs = vi.mocked(listAllComments).mock.calls[0];
    expect(firstCallArgs?.[1]).toEqual({});
  });
});