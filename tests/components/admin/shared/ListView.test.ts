// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
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
});