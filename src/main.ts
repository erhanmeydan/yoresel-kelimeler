import './styles/main.css';
import { renderHeader } from './components/Header';
import { renderHomePage } from './pages/HomePage';

type Page = 'home' | 'contribute' | 'profile' | 'moderation';

function parseRoute(): Page {
  const hash = window.location.hash.replace('#/', '').split('/')[0] ?? 'home';
  if (hash === 'contribute' || hash === 'profile' || hash === 'moderation') return hash;
  return 'home';
}

async function render(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  app.innerHTML = '<div id="header-slot"></div><div id="page-slot"></div>';
  renderHeader(document.getElementById('header-slot')!);

  const slot = document.getElementById('page-slot')!;
  const page = parseRoute();
  if (page === 'home') await renderHomePage(slot);
  if (page === 'contribute') {
    const { renderContributePage } = await import('./pages/ContributePage');
    await renderContributePage(slot);
  }
  if (page === 'moderation') {
    const { renderModerationPage } = await import('./pages/ModerationPage');
    await renderModerationPage(slot);
  }
  // profile ileride eklenecek
}

window.addEventListener('hashchange', () => void render());
void render();
