import { auth, db } from '../config/firebase';
import { ensureAuthReady, getProfile } from '../services/auth.service';
import { renderTabBar, type AdminTab } from '../components/admin/shared/TabBar';
import { renderReportsTab } from '../components/admin/tabs/ReportsTab';
import { renderCommentsTab } from '../components/admin/tabs/CommentsTab';
import { renderEntriesTab } from '../components/admin/tabs/EntriesTab';
import { renderUsersTab } from '../components/admin/tabs/UsersTab';
import { renderStatsTab, MODERATION_SWITCH_TAB_EVENT } from '../components/admin/tabs/StatsTab';

function getTabFromUrl(): AdminTab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (['reports', 'comments', 'entries', 'users', 'stats'].includes(tab ?? '')) {
    return tab as AdminTab;
  }
  return 'reports';
}

function setTabInUrl(tab: AdminTab): void {
  const params = new URLSearchParams(window.location.search);
  params.set('tab', tab);
  window.history.replaceState({}, '', `?${params.toString()}`);
}

// Single global listener — the moderation page can be re-rendered in tests
// and we don't want stale listeners to fire duplicate tab-switches.
let activeSwitchTabListener: ((event: Event) => void) | null = null;

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
    setTabInUrl(tab);
    contentContainer.innerHTML = '';
    contentContainer.setAttribute('role', 'tabpanel');
    switch (tab) {
      case 'reports':
        await renderReportsTab(contentContainer);
        break;
      case 'comments':
        await renderCommentsTab(contentContainer);
        break;
      case 'entries':
        await renderEntriesTab(contentContainer);
        break;
      case 'users':
        await renderUsersTab(contentContainer);
        break;
      case 'stats':
        await renderStatsTab(contentContainer);
        break;
    }
  };

  // Stable handler: re-render TabBar with THIS same callback so subsequent
  // tab clicks keep working. The previous version used `() => {}` on
  // re-render, which silently broke tab switching after the first change.
  const handleTabChange = (tab: AdminTab): void => {
    setTabInUrl(tab);
    renderTabBar(tabBarContainer, tab, handleTabChange);
    void loadTab(tab);
  };
  const initialTab = getTabFromUrl();
  renderTabBar(tabBarContainer, initialTab, handleTabChange);

  // Listen for in-page cross-tab navigation requests (e.g. the "Raporları Gör"
  // button on the Stats tab). Keep this in sync with the URL so refresh and
  // back/forward still work after the switch.
  const onSwitchTab = (event: Event): void => {
    const detail = (event as CustomEvent<{ tab?: AdminTab }>).detail;
    const next = detail?.tab;
    if (!next || !['reports', 'comments', 'entries', 'users', 'stats'].includes(next)) return;
    handleTabChange(next);
  };
  if (activeSwitchTabListener) {
    window.removeEventListener(MODERATION_SWITCH_TAB_EVENT, activeSwitchTabListener);
  }
  window.addEventListener(MODERATION_SWITCH_TAB_EVENT, onSwitchTab);
  activeSwitchTabListener = onSwitchTab;

  await loadTab(initialTab);
}