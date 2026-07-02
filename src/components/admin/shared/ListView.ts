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
  container.innerHTML = '<p class="list-view__loading">Yükleniyor...</p>';

  const filterValues: Record<string, string> = {};
  for (const f of config.filters) {
    if (f.type === 'select' && f.options?.[0]) filterValues[f.key] = f.options[0].value;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentCursor: unknown = undefined;

  // Render filter bar
  const filterBar = document.createElement('div');
  filterBar.className = 'list-view__filter-bar';
  for (const filter of config.filters) {
    const wrap = document.createElement('div');
    wrap.className = 'list-view__filter';
    const label = document.createElement('label');
    label.textContent = filter.label;
    label.className = 'list-view__filter-label';
    wrap.append(label);
    if (filter.type === 'text') {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = filter.label;
      input.value = filterValues[filter.key] ?? '';
      input.addEventListener('input', () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          filterValues[filter.key] = input.value;
          currentCursor = undefined; // reset on filter change
          void renderRows({ ...filterValues }, undefined, false);
        }, 300);
      });
      wrap.append(input);
    } else if (filter.type === 'select' && filter.options) {
      const select = document.createElement('select');
      for (const opt of filter.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.append(option);
      }
      select.value = filterValues[filter.key] ?? filter.options[0].value;
      select.addEventListener('change', () => {
        filterValues[filter.key] = select.value;
        currentCursor = undefined; // reset on filter change
        void renderRows({ ...filterValues }, undefined, false);
      });
      wrap.append(select);
    }
    filterBar.append(wrap);
  }

  container.innerHTML = '';
  container.append(filterBar);
  const tableContainer = document.createElement('div');
  tableContainer.className = 'list-view__table-container';
  container.append(tableContainer);

  await renderRows({ ...filterValues }, undefined, false);

  async function renderRows(
    filterVals: Record<string, string>,
    cursor: unknown,
    append: boolean,
  ): Promise<void> {
    if (!append) {
      tableContainer.innerHTML = '<p class="list-view__loading">Yükleniyor...</p>';
    } else {
      // Remove old pagination during load
      tableContainer.querySelector('.list-view__pagination')?.remove();
    }
    const result = await config.fetch(filterVals, cursor);

    if (!append) {
      tableContainer.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'list-view';
      table.setAttribute('role', 'grid');

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

      const tbody = document.createElement('tbody');
      table.append(tbody);
      tableContainer.append(table);
    }

    const tbody = tableContainer.querySelector('tbody');

    if (!result.ok || !result.data || result.data.items.length === 0) {
      if (!append && tbody) {
        const empty = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = config.columns.length + (config.actions.length > 0 ? 1 : 0);
        td.className = 'list-view__empty';
        td.textContent = result.error?.message ?? config.emptyMessage;
        empty.append(td);
        tbody.append(empty);
      }
    } else if (tbody) {
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

    // Add pagination if more results available
    if (result.data?.hasMore && result.data.lastVisible !== undefined) {
      const pagination = document.createElement('div');
      pagination.className = 'list-view__pagination';
      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-secondary list-view__pagination-next';
      nextBtn.textContent = 'Sonraki →';
      const lastVis = result.data.lastVisible;
      const filterSnapshot = { ...filterVals };
      nextBtn.addEventListener('click', () => {
        void renderRows(filterSnapshot, lastVis, true);
      });
      pagination.append(nextBtn);
      tableContainer.append(pagination);
    }

    if (append) {
      currentCursor = result.data?.lastVisible ?? cursor;
    }
  }
}
