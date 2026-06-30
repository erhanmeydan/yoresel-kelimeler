import { getAdminStats } from '../../services/admin.service';

export async function renderStatsTab(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const result = await getAdminStats();
  if (!result.ok) {
    const err = document.createElement('p');
    err.className = 'error';
    err.textContent = result.error.message;
    container.appendChild(err);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'stats-grid';

  grid.appendChild(buildWidget('Açık Raporlar', result.data.reportsOpen));
  grid.appendChild(buildWidget('Bugün Silinen Yorum', result.data.commentsDeletedToday));
  grid.appendChild(buildWidget('Engellenen Kullanıcı', result.data.blockedUsersCount));

  container.appendChild(grid);
}

function buildWidget(label: string, value: number): HTMLElement {
  const w = document.createElement('div');
  w.className = 'stat-widget';

  const l = document.createElement('span');
  l.className = 'stat-label';
  l.textContent = label;

  const v = document.createElement('span');
  v.className = 'stat-value';
  v.textContent = String(value);

  w.append(l, v);
  return w;
}