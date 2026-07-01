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
 * restore async, which races against page render.
 *
 * Aggressive fallback chain (PR #19):
 * 1. Sync currentUser check
 * 2. Try getIdToken(true) — forces token refresh, may unblock restoration
 * 3. onAuthStateChanged observer
 * 4. 5s poll for sync currentUser to become non-null
 * 5. Final sync check at 5s timeout
 *
 * If after 5s the user is still null, returns null. Caller should handle
 * this by re-prompting the user to log in.
 */
async function waitForAuthUser(): Promise<typeof auth.currentUser> {
  // 1. Sync check
  if (auth.currentUser) return auth.currentUser;

  // 2. Force token refresh — sometimes triggers restoration
  try {
    const initialUser = (auth as unknown as { currentUser: { getIdToken: (force: boolean) => Promise<string> } | null }).currentUser;
    if (initialUser) {
      await initialUser.getIdToken(true);
      if (auth.currentUser) return auth.currentUser;
    }
  } catch {
    // ignore
  }

  // 3. Observer + 4. Poll, return at 5s
  return new Promise((resolve) => {
    let resolved = false;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!resolved) {
        resolved = true;
        unsub();
        clearInterval(poll);
        resolve(user);
      }
    });
    const start = Date.now();
    const poll = setInterval(() => {
      if (auth.currentUser && !resolved) {
        resolved = true;
        unsub();
        clearInterval(poll);
        resolve(auth.currentUser);
        return;
      }
      if (Date.now() - start > 5000 && !resolved) {
        resolved = true;
        unsub();
        clearInterval(poll);
        resolve(auth.currentUser);
      }
    }, 100);
  });
}

export async function renderModerationPage(container: HTMLElement): Promise<void> {
  // Show "Yükleniyor..." while we wait for auth state
  container.innerHTML = '<p class="muted">Yükleniyor...</p>';

  const user = await waitForAuthUser();
  if (!user) {
    // After 5s, auth still missing — show explicit re-login prompt
    container.innerHTML = `
      <div class="page-container moderation-page">
        <h2>Moderasyon Paneli</h2>
        <p class="error">Oturum açılamadı. Lütfen tekrar giriş yapın.</p>
        <a class="btn btn-primary" href="/contribute">Giriş sayfasına git</a>
      </div>
    `;
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
