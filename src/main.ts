import './styles/main.css';
import 'leaflet/dist/leaflet.css';
import { renderHeader } from './components/Header';
import { renderFooter } from './components/Footer';
import { renderHomePage } from './pages/HomePage';
import { auth, db } from './config/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, collection } from 'firebase/firestore';
import type { Entry } from './types/models';

// Resolve once the first auth state (restored from IndexedDB) is known, so
// protected pages and owner-only UI don't read a premature `null` user on a
// direct load / refresh (#13). Cached so subsequent renders are instant.
let authReady: Promise<User | null> | null = null;
function waitForAuth(): Promise<User | null> {
  if (!authReady) {
    authReady = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user);
      });
    });
  }
  return authReady;
}

type Page =
  | { kind: 'home' }
  | { kind: 'contribute'; editId?: string }
  | { kind: 'profile' }
  | { kind: 'moderation' }
  | { kind: 'entry'; slug: string };

function parseRoute(): Page {
  const path = window.location.pathname.replace(/^\//, '');
  const [head, ...rest] = path.split('/').filter(Boolean);
  if (head === 'contribute') {
    const editId = new URLSearchParams(window.location.search).get('edit') ?? undefined;
    return editId
      ? { kind: 'contribute', editId }
      : { kind: 'contribute' };
  }
  if (head === 'profile') return { kind: 'profile' };
  if (head === 'moderation') return { kind: 'moderation' };
  if (head === 'entry' && rest[0]) return { kind: 'entry', slug: rest[0] };
  return { kind: 'home' };
}

async function migrateHashUrl(): Promise<void> {
  const hash = window.location.hash;
  const m = hash.match(/^#\/entry\/([^/?#]+)/);
  if (!m) return;
  const id = m[1];
  try {
    const entryRef = doc(collection(db, 'entries'), id);
    const snap = await getDoc(entryRef);
    if (!snap.exists()) {
      // Bilinmeyen hash → home
      window.history.replaceState({}, '', '/');
      return;
    }
    const slug = (snap.data() as Entry).slug;
    if (slug) {
      window.history.replaceState({}, '', `/entry/${slug}`);
    }
  } catch {
    window.history.replaceState({}, '', '/');
  }
}

async function render(): Promise<void> {
  // Ensure Firebase has finished restoring the session before any page reads
  // auth.currentUser synchronously.
  await waitForAuth();
  await migrateHashUrl();

  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  app.innerHTML = '<div id="header-slot"></div><div id="page-slot"></div><footer id="footer-slot"></footer>';
  renderHeader(document.getElementById('header-slot')!);
  renderFooter(document.getElementById('footer-slot')!);

  const slot = document.getElementById('page-slot')!;
  const page = parseRoute();
  if (page.kind === 'home') await renderHomePage(slot);
  else if (page.kind === 'contribute') {
    const { renderContributePage } = await import('./pages/ContributePage');
    await renderContributePage(slot, page.editId);
  }
  else if (page.kind === 'moderation') {
    const { renderModerationPage } = await import('./pages/ModerationPage');
    await renderModerationPage(slot);
  }
  else if (page.kind === 'profile') {
    const { renderProfilePage } = await import('./pages/ProfilePage');
    await renderProfilePage(slot);
  }
  else if (page.kind === 'entry') {
    const { renderEntryDetailPage } = await import('./pages/EntryDetailPage');
    await renderEntryDetailPage(slot, page.slug);
  }
}

window.addEventListener('popstate', () => void render());

// SPA navigation: internal path linklerini yakala, default reload yerine history.pushState
document.addEventListener('click', (e) => {
  const link = (e.target as Element | null)?.closest('a[href^="/"]') as HTMLAnchorElement | null;
  if (!link) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (link.target === '_blank') return;
  e.preventDefault();
  window.history.pushState({}, '', link.getAttribute('href')!);
  void render();
});

void render();