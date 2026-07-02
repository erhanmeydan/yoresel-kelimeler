import { db } from '../../../config/firebase';
import { getAdminStats } from '../../../services/admin.service';
import { listReports } from '../../../services/admin/reports.service';

export const MODERATION_SWITCH_TAB_EVENT = 'moderation:switch-tab';

export async function renderStatsTab(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  // Open-reports count comes directly from the reports collection so the
  // dashboard reflects fresh data without depending on the cached
  // getAdminStats() aggregate. Page size is small — this is a counter, not a
  // list — so the extra read is cheap.
  const reportsResult = await listReports(db, { status: 'open' });
  const reportsOpen = reportsResult.ok ? (reportsResult.data?.items.length ?? 0) : 0;

  const statsResult = await getAdminStats();
  const commentsDeletedToday = statsResult.ok ? statsResult.data.commentsDeletedToday : 0;
  const blockedUsersCount = statsResult.ok ? statsResult.data.blockedUsersCount : 0;

  if (!statsResult.ok && reportsOpen === 0) {
    // Both sources failed (or only stats failed and we have no fallback) —
    // surface the error so the moderator isn't looking at zeros silently.
    const err = document.createElement('p');
    err.className = 'error';
    err.textContent = statsResult.ok ? 'Raporlar yüklenemedi.' : statsResult.error.message;
    container.appendChild(err);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'stats-grid';

  grid.appendChild(buildReportsWidget(reportsOpen));
  grid.appendChild(buildWidget('Bugün Silinen Yorum', commentsDeletedToday));
  grid.appendChild(buildWidget('Engellenen Kullanıcı', blockedUsersCount));

  container.appendChild(grid);
}

function buildReportsWidget(value: number): HTMLElement {
  const w = buildWidget('Açık Raporlar', value);
  w.classList.add('stat-widget--reports');

  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'stat-widget__link btn btn-sm btn-secondary';
  link.textContent = 'Raporları Gör →';
  link.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent(MODERATION_SWITCH_TAB_EVENT, {
      detail: { tab: 'reports' },
    }));
  });
  w.append(link);
  return w;
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