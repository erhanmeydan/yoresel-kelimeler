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
 * PR #11 added setPersistence(browserLocalPersistence). This makes auth state
 * restore async, which races against page render. We use a robust 3-stage
 * fallback: sync check → 200ms poll → observer + 2s timeout.
 */
function waitForAuthUser(): Promise<typeof auth.currentUser> {
  return new Promise((resolve) => {
    // 1. Sync check (most common case after first load)
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    // 2. Observer (waits for restore to settle)
    let resolved = false;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!resolved) {
        resolved = true;
        unsub();
        resolve(user);
      }
    });

    // 3. Poll fallback (in case observer doesn't fire — 2s timeout)
    const start = Date.now();
    const poll = setInterval(() => {
      if (auth.currentUser && !resolved) {
        resolved = true;
        unsub();
        clearInterval(poll);
        resolve(auth.currentUser);
        return;
      }
      if (Date.now() - start > 2000 && !resolved) {
        resolved = true;
        unsub();
        clearInterval(poll);
        resolve(auth.currentUser);
      }
    }, 50);
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
