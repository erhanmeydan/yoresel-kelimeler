// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderListView, type ListViewConfig } from '../../../../src/components/admin/shared/ListView';

interface Item { id: string; name: string }

describe('ListView', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="root"></div>'; });

  it('renders header from columns config', async () => {
    const config: ListViewConfig<Item> = {
      columns: [
        { key: 'name', label: 'İsim', render: i => i.name },
      ],
      actions: [],
      filters: [],
      fetch: async () => ({ ok: true, data: { items: [{ id: '1', name: 'test' }], hasMore: false } }),
      emptyMessage: 'Boş',
    };
    await renderListView(document.getElementById('root')!, config);
    expect(document.querySelector('.list-view__header th')?.textContent).toBe('İsim');
  });

  it('renders rows from fetch result', async () => {
    const config: ListViewConfig<Item> = {
      columns: [{ key: 'name', label: 'İsim', render: i => i.name }],
      actions: [],
      filters: [],
      fetch: async () => ({ ok: true, data: { items: [{ id: '1', name: 'foo' }, { id: '2', name: 'bar' }], hasMore: false } }),
      emptyMessage: 'Boş',
    };
    await renderListView(document.getElementById('root')!, config);
    const rows = document.querySelectorAll('.list-view__row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('foo');
  });

  it('shows empty state when no items', async () => {
    const config: ListViewConfig<Item> = {
      columns: [{ key: 'name', label: 'İsim', render: i => i.name }],
      actions: [],
      filters: [],
      fetch: async () => ({ ok: true, data: { items: [], hasMore: false } }),
      emptyMessage: 'Hiç öğe yok.',
    };
    await renderListView(document.getElementById('root')!, config);
    expect(document.querySelector('.list-view__empty')?.textContent).toBe('Hiç öğe yok.');
  });

  it('renders filter bar with text input', async () => {
    const config: ListViewConfig<Item> = {
      columns: [{ key: 'name', label: 'İsim', render: i => i.name }],
      actions: [],
      filters: [{ key: 'q', label: 'Ara', type: 'text' }],
      fetch: async () => ({ ok: true, data: { items: [], hasMore: false } }),
      emptyMessage: 'Boş',
    };
    await renderListView(document.getElementById('root')!, config);
    const input = document.querySelector<HTMLInputElement>('.list-view__filter input');
    expect(input).toBeTruthy();
    expect(input?.placeholder).toBe('Ara');
  });

  it('refetches when filter changes', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, data: { items: [], hasMore: false } });
    const config: ListViewConfig<Item> = {
      columns: [{ key: 'name', label: 'İsim', render: i => i.name }],
      actions: [],
      filters: [{ key: 'q', label: 'Ara', type: 'text' }],
      fetch,
      emptyMessage: 'Boş',
    };
    await renderListView(document.getElementById('root')!, config);
    expect(fetch).toHaveBeenCalledTimes(1);
    const input = document.querySelector<HTMLInputElement>('.list-view__filter input')!;
    input.value = 'foo';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 350)); // debounce
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toEqual({ q: 'foo' });
  });

  it('shows pagination when hasMore=true', async () => {
    const config: ListViewConfig<Item> = {
      columns: [{ key: 'name', label: 'İsim', render: i => i.name }],
      actions: [],
      filters: [],
      fetch: async () => ({ ok: true, data: { items: [{ id: '1', name: 'a' }], hasMore: true, lastVisible: 'cursor1' } }),
      emptyMessage: 'Boş',
    };
    await renderListView(document.getElementById('root')!, config);
    expect(document.querySelector('.list-view__pagination-next')).toBeTruthy();
  });

  it('hides pagination when hasMore=false', async () => {
    const config: ListViewConfig<Item> = {
      columns: [{ key: 'name', label: 'İsim', render: i => i.name }],
      actions: [],
      filters: [],
      fetch: async () => ({ ok: true, data: { items: [], hasMore: false } }),
      emptyMessage: 'Boş',
    };
    await renderListView(document.getElementById('root')!, config);
    expect(document.querySelector('.list-view__pagination-next')).toBeFalsy();
  });

  it('renders select filter with options', async () => {
    const config: ListViewConfig<Item> = {
      columns: [{ key: 'name', label: 'İsim', render: i => i.name }],
      actions: [],
      filters: [{
        key: 'status', label: 'Durum', type: 'select',
        options: [{ value: 'all', label: 'Hepsi' }, { value: 'active', label: 'Aktif' }],
      }],
      fetch: async () => ({ ok: true, data: { items: [], hasMore: false } }),
      emptyMessage: 'Boş',
    };
    await renderListView(document.getElementById('root')!, config);
    const select = document.querySelector<HTMLSelectElement>('.list-view__filter select');
    expect(select?.options.length).toBe(2);
  });
});