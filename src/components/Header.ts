import { auth } from '../config/firebase';
import { logout, observeAuth } from '../services/auth.service';
import { showAuthModal } from './AuthModal';

export function renderHeader(container: HTMLElement): void {
  container.innerHTML = `
    <header class="app-header">
      <a href="#/" class="brand">
        <span class="brand-mark">YK</span>
        <span class="brand-text">Yöresel Kelimeler</span>
      </a>
      <nav class="header-nav">
        <a href="#/">Harita</a>
        <a href="#/contribute">Katkı</a>
      </nav>
      <div class="header-auth" id="auth-slot"></div>
    </header>
  `;

  const authSlot = container.querySelector<HTMLDivElement>('#auth-slot')!;

  observeAuth(auth, (user) => {
    if (user) {
      authSlot.innerHTML = `
        <div class="profile-menu">
          <button class="profile-button">${user.displayName ?? user.email}</button>
          <div class="profile-dropdown" hidden>
            <a href="#/profile">Profilim</a>
            <button id="logout-btn">Çıkış Yap</button>
          </div>
        </div>
      `;
      const button = authSlot.querySelector<HTMLButtonElement>('.profile-button')!;
      const dropdown = authSlot.querySelector<HTMLDivElement>('.profile-dropdown')!;
      button.addEventListener('click', () => { dropdown.hidden = !dropdown.hidden; });
      authSlot.querySelector<HTMLButtonElement>('#logout-btn')!.addEventListener('click', async () => {
        await logout(auth);
        dropdown.hidden = true;
      });
    } else {
      authSlot.innerHTML = '<button class="btn-primary" id="login-btn">Giriş Yap</button>';
      authSlot.querySelector<HTMLButtonElement>('#login-btn')!.addEventListener('click', () => {
        showAuthModal(() => {});
      });
    }
  });
}