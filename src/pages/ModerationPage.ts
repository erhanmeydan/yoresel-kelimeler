import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { getProfile } from '../services/auth.service';
import { renderTabBar, type AdminTab } from '../components/admin/shared/TabBar';
import { renderReportsTab } from '../components/admin/ReportsTab';
import { renderCommentsTab } from '../components/admin/CommentsTab';
import { renderUsersTab } from '../components/admin/UsersTab';
import { renderStatsTab } from '../components/admin/StatsTab';

/**
 * Waits for Firebase Auth state to be ready.
 * After PR #11 (setPersistence(browserLocalPersistence)), auth.currentUser
 * is asynchronously restored on page load. Page render runs sync and
 * may capture null. This helper ensures we have the user (or null) before
 * proceeding.
 */
function waitForAuthUser(): Promise<typeof auth.currentUser> {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function renderModerationPage(container: HTMLElement): Promise<void> {
  const user = await waitForAuthUser();
  if (!user) {
    container.innerHTML = '<p class="error">Yetkisiz. Giriş yapın.</p>';
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