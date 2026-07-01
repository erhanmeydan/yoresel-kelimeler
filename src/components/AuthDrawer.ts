import { auth, db } from '../config/firebase';
import { login, register, signInWithGoogle } from '../services/auth.service';
import { validateRegister } from '../utils/validation';
import { sanitizeText } from '../utils/sanitize';

const GOOGLE_ICON = `
<svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
</svg>
`;

export function showAuthDrawer(mode: 'login' | 'register' = 'login'): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="auth-drawer" role="dialog" aria-modal="true" aria-labelledby="auth-drawer-title">
      <header class="auth-drawer-head">
        <a href="/" class="brand-mark">Yöresel</a>
        <button class="drawer-close" aria-label="Kapat" type="button">×</button>
      </header>
      <div class="auth-drawer-body">
        <p class="drawer-lede" id="auth-drawer-title">
          ${mode === 'login'
            ? 'Yöresel sözlüğe katkıda bulunmak için giriş yapın.'
            : 'Yeni bir hesap oluşturarak kültürel arşive katkıda bulunun.'}
        </p>
        <form id="auth-form" class="auth-form" novalidate>
          <button type="button" class="btn-google">
            ${GOOGLE_ICON}
            <span>Google ile devam et</span>
          </button>
          <div class="auth-divider"><span>veya e-posta ile</span></div>
          <label class="auth-field" data-field="displayName" ${mode === 'login' ? 'hidden' : ''}>
            <span>Ad</span>
            <input name="displayName" required minlength="2" maxlength="40" autocomplete="name" />
          </label>
          <label class="auth-field">
            <span>E-posta</span>
            <input name="email" type="email" required autocomplete="email" />
          </label>
          <label class="auth-field">
            <span>Şifre</span>
            <input name="password" type="password" required minlength="10" autocomplete="current-password" />
          </label>
          <p class="auth-error" role="alert" hidden></p>
          <button type="submit" class="btn btn-primary auth-submit">${mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}</button>
        </form>
        <p class="drawer-toggle">
          <span data-show="login" ${mode === 'login' ? 'hidden' : ''}>
            Zaten hesabın var mı?
            <button type="button" data-action="login" class="drawer-toggle-link">Giriş yap</button>
          </span>
          <span data-show="register" ${mode === 'register' ? 'hidden' : ''}>
            Hesabın yok mu?
            <button type="button" data-action="register" class="drawer-toggle-link">Kayıt ol</button>
          </span>
        </p>
      </div>
    </aside>
  `;
  document.body.appendChild(backdrop);

  const drawer = backdrop.querySelector<HTMLElement>('.auth-drawer')!;
  const form = backdrop.querySelector<HTMLFormElement>('#auth-form')!;
  const errorEl = backdrop.querySelector<HTMLElement>('.auth-error')!;
  const nameField = backdrop.querySelector<HTMLElement>('[data-field="displayName"]')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const lede = backdrop.querySelector<HTMLElement>('.drawer-lede')!;

  const close = (): void => backdrop.remove();

  const setMode = (next: 'login' | 'register'): void => {
    mode = next;
    nameField.hidden = mode === 'login';
    errorEl.hidden = true;
    errorEl.textContent = '';
    form.reset();
    submitBtn.textContent = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
    lede.textContent = mode === 'login'
      ? 'Yöresel sözlüğe katkıda bulunmak için giriş yapın.'
      : 'Yeni bir hesap oluşturarak kültürel arşive katkıda bulunun.';
    backdrop.querySelectorAll<HTMLElement>('[data-show]').forEach((el) => {
      el.hidden = el.dataset.show !== mode;
    });
    const firstInput = form.querySelector<HTMLInputElement>(mode === 'login' ? 'input[name="email"]' : 'input[name="displayName"]');
    firstInput?.focus();
  };

  backdrop.querySelector<HTMLButtonElement>('.drawer-close')!.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  // Escape key
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onEsc);
    }
  });

  // Toggle links
  backdrop.querySelectorAll<HTMLButtonElement>('.drawer-toggle-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action as 'login' | 'register';
      setMode(action);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;

    const fd = new FormData(form);
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const displayName = sanitizeText(String(fd.get('displayName') ?? ''));

    if (mode === 'register') {
      const validation = validateRegister({ email, password, displayName });
      if (!validation.ok) {
        errorEl.textContent = validation.errors.map((er) => er.message).join(' ');
        errorEl.hidden = false;
        submitBtn.disabled = false;
        return;
      }
    }

    const result = mode === 'login'
      ? await login(auth, email, password)
      : await register(auth, db, email, password, displayName);

    if (result.ok) {
      close();
    } else {
      errorEl.textContent = result.error.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
    }
  });

  // Google sign-in
  const googleBtn = backdrop.querySelector<HTMLButtonElement>('.btn-google')!;
  googleBtn.addEventListener('click', async () => {
    errorEl.hidden = true;
    googleBtn.disabled = true;
    const result = await signInWithGoogle(auth, db);
    if (result.ok) {
      close();
    } else {
      errorEl.textContent = result.error.message;
      errorEl.hidden = false;
      googleBtn.disabled = false;
    }
  });

  // Focus first input
  const firstVisible = form.querySelector<HTMLInputElement>(mode === 'login' ? 'input[name="email"]' : 'input[name="displayName"]');
  firstVisible?.focus();
}