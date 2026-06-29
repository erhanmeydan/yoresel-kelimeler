import { auth } from '../config/firebase';
import { logout, observeAuth } from '../services/auth.service';
import { showAuthDrawer } from './AuthDrawer';

function currentPath(): string {
  return window.location.pathname.replace(/^\//, '') || '';
}

function isActive(target: string): boolean {
  const path = currentPath();
  if (target === '') return path === '' || path === 'home';
  return path === target || path.startsWith(`${target}/`);
}

function getInitials(name: string | null, email: string | null): string {
  const source = name || email || '';
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export function renderHeader(container: HTMLElement): void {
  container.innerHTML = `
    <header class="app-header">
      <a href="/" class="brand" aria-label="Yöresel Kelimeler anasayfa">
        <span class="brand-mark">Yöresel</span>
        <span class="brand-meta">Sözlük · Harita</span>
      </a>
      <nav class="header-nav" aria-label="Ana navigasyon">
        <a href="/" data-nav="">Harita</a>
        <a href="/contribute" data-nav="contribute">Katkı</a>
      </nav>
      <div class="header-auth" id="auth-slot"></div>
    </header>
  `;

  // Mark active nav
  const links = container.querySelectorAll<HTMLAnchorElement>('[data-nav]');
  links.forEach((a) => {
    const target = a.getAttribute('data-nav') ?? '';
    if (isActive(target)) a.classList.add('active');
  });

  const authSlot = container.querySelector<HTMLDivElement>('#auth-slot')!;

  observeAuth(auth, (user) => {
    if (user) {
      const initials = getInitials(user.displayName, user.email);
      const displayLabel = user.displayName ?? user.email ?? 'Profil';

      // Build profile menu safely — no innerHTML with user-controlled values (XSS)
      authSlot.replaceChildren();
      const menu = document.createElement('div');
      menu.className = 'profile-menu';

      const button = document.createElement('button');
      button.className = 'profile-button';
      button.setAttribute('aria-haspopup', 'true');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Profil menüsü');

      const avatar = document.createElement('span');
      avatar.className = 'profile-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = initials;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'profile-name';
      nameSpan.textContent = displayLabel;

      button.append(avatar, nameSpan);

      const dropdown = document.createElement('div');
      dropdown.className = 'profile-dropdown';
      dropdown.setAttribute('role', 'menu');
      dropdown.hidden = true;

      const profileLink = document.createElement('a');
      profileLink.href = '/profile';
      profileLink.setAttribute('role', 'menuitem');
      profileLink.textContent = 'Profilim';

      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'logout-btn';
      logoutBtn.setAttribute('role', 'menuitem');
      logoutBtn.type = 'button';
      logoutBtn.textContent = 'Çıkış Yap';

      dropdown.append(profileLink, logoutBtn);
      menu.append(button, dropdown);
      authSlot.appendChild(menu);

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !dropdown.hidden;
        dropdown.hidden = isOpen;
        button.setAttribute('aria-expanded', String(!isOpen));
      });

      document.addEventListener('click', (e) => {
        if (!authSlot.contains(e.target as Node)) {
          dropdown.hidden = true;
          button.setAttribute('aria-expanded', 'false');
        }
      });

      logoutBtn.addEventListener('click', async () => {
        await logout(auth);
        dropdown.hidden = true;
      });
    } else {
      // Login/register buttons — safe (no user data)
      authSlot.innerHTML = `
        <button class="btn btn-secondary" id="login-btn" type="button">Giriş Yap</button>
        <button class="btn btn-primary" id="register-btn" type="button">Katkıda Bulun</button>
      `;
      authSlot.querySelector<HTMLButtonElement>('#login-btn')!.addEventListener('click', () => {
        showAuthDrawer('login');
      });
      authSlot.querySelector<HTMLButtonElement>('#register-btn')!.addEventListener('click', () => {
        showAuthDrawer('register');
      });
    }
  });
}