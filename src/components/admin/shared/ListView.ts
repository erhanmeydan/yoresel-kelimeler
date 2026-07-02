export interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => HTMLElement | string;
  width?: string;
}

export interface Action<T> {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: (item: T) => void | Promise<void>;
  isVisible?: (item: T) => boolean;
}

export interface Filter {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: Array<{ value: string; label: string }>;
}

export interface ListViewConfig<T> {
  columns: Array<Column<T>>;
  actions: Array<Action<T>>;
  filters: Filter[];
  fetch: (filterValues: Record<string, string>, page?: unknown) => Promise<{
    ok: boolean;
    data?: { items: T[]; hasMore: boolean; lastVisible?: unknown };
    error?: { code: string; message: string };
  }>;
  emptyMessage: string;
  pageSize?: number;
}

export async function renderListView<T extends { id: string }>(
  container: HTMLElement,
  config: ListViewConfig<T>,
): Promise<void> {
  // Show loading
  container.innerHTML = '<p class="list-view__loading">Yükleniyor...</p>';

  const result = await config.fetch({});
  container.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'list-view';
  table.setAttribute('role', 'grid');

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.className = 'list-view__header';
  for (const col of config.columns) {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.width) th.style.width = col.width;
    headerRow.append(th);
  }
  if (config.actions.length > 0) {
    const th = document.createElement('th');
    th.textContent = 'Aksiyon';
    headerRow.append(th);
  }
  thead.append(headerRow);
  table.append(thead);

  // Body
  const tbody = document.createElement('tbody');
  if (!result.ok || !result.data || result.data.items.length === 0) {
    const empty = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = config.columns.length + (config.actions.length > 0 ? 1 : 0);
    td.className = 'list-view__empty';
    td.textContent = result.error?.message ?? config.emptyMessage;
    empty.append(td);
    tbody.append(empty);
  } else {
    for (const item of result.data.items) {
      const row = document.createElement('tr');
      row.className = 'list-view__row';
      row.setAttribute('data-id', item.id);
      for (const col of config.columns) {
        const td = document.createElement('td');
        const rendered = col.render(item);
        td.append(typeof rendered === 'string' ? document.createTextNode(rendered) : rendered);
        row.append(td);
      }
      if (config.actions.length > 0) {
        const actionTd = document.createElement('td');
        for (const action of config.actions) {
          if (action.isVisible && !action.isVisible(item)) continue;
          const btn = document.createElement('button');
          btn.className = `btn btn-sm btn-${action.variant ?? 'secondary'}`;
          btn.textContent = action.label;
          btn.addEventListener('click', () => void action.onClick(item));
          actionTd.append(btn);
        }
        row.append(actionTd);
      }
      tbody.append(row);
    }
  }
  table.append(tbody);
  container.append(table);
}