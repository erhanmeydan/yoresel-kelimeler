import { auth, db } from '../config/firebase';
import { ensureAuthReady, getProfile } from '../services/auth.service';
import { renderTabBar, type AdminTab } from '../components/admin/shared/TabBar';
import { renderReportsTab } from '../components/admin/ReportsTab';
import { renderCommentsTab } from '../components/admin/tabs/CommentsTab';
import { renderUsersTab } from '../components/admin/tabs/UsersTab';
import { renderStatsTab } from '../components/admin/StatsTab';

export async function renderModerationPage(container: HTMLElement): Promise<void> {
  // CRITICAL: wait for Firebase Auth to finish restoring the persisted
  // session. `auth.currentUser` is null until that completes — see
  // ensureAuthReady in src/services/auth.service.ts for the full reason.
  // Without this, signed-in users see "Yetkisiz" on /moderation while
  // /profile still works.
  const user = await ensureAuthReady(auth);
  if (!user) {
    container.innerHTML = '<p class="error">Bu sayfayı görüntülemek için giriş yapmalısınız.</p>';
    return;
  }

  const profileResult = await getProfile(db, user.uid);
  if (!profileResult.ok || !profileResult.data || !['moderator', 'admin'].includes(profileResult.data.role)) {
    container.innerHTML = '<p class="error">Bu sayfaya erişim yetkiniz yok.</p>';
    return;
  }

  container.innerHTML = `
    <div class="page-container moderation-page">
      <h2>Moderasyon Paneli</h2>
      <div class="tab-bar-container"></div>
      <div id="tab-content"></div>
    </div>
  `;

  const tabBarContainer = container.querySelector<HTMLDivElement>('.tab-bar-container')!;
  const contentContainer = container.querySelector<HTMLDivElement>('#tab-content')!;

  const loadTab = async (tab: AdminTab): Promise<void> => {
    contentContainer.innerHTML = '';
    contentContainer.setAttribute('role', 'tabpanel');
    switch (tab) {
      case 'reports':
        await renderReportsTab(contentContainer);
        break;
      case 'comments':
        await renderCommentsTab(contentContainer);
        break;
      case 'users':
        await renderUsersTab(contentContainer);
        break;
      case 'stats':
        await renderStatsTab(contentContainer);
        break;
    }
  };

  renderTabBar(tabBarContainer, 'reports', async (tab) => {
    renderTabBar(tabBarContainer, tab, () => {});
    await loadTab(tab);
  });

  await loadTab('reports');
}
