import { auth, db } from '../config/firebase';
import { getProfile } from '../services/auth.service';
import { renderTabBar, type AdminTab } from '../components/admin/shared/TabBar';
import { renderReportsTab } from '../components/admin/ReportsTab';
import { renderCommentsTab } from '../components/admin/CommentsTab';
import { renderUsersTab } from '../components/admin/UsersTab';
import { renderStatsTab } from '../components/admin/StatsTab';

export async function renderModerationPage(container: HTMLElement): Promise<void> {
  // Simple sync auth check. If not authenticated, send the user to the page
  // that hosts the auth drawer. No async wait, no observer, no polling.
  const user = auth.currentUser;
  if (!user) {
    window.location.href = '/contribute';
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
