import { auth, db } from '../config/firebase';
import { login, register } from '../services/auth.service';

export function showAuthModal(onSuccess: () => void): void {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <header class="modal-header">
        <h2 id="auth-title">Giriş Yap</h2>
        <button class="modal-close" aria-label="Kapat">×</button>
      </header>
      <div class="modal-body">
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Giriş</button>
          <button class="auth-tab" data-tab="register">Kayıt</button>
        </div>
        <form id="auth-form" class="auth-form">
          <label class="auth-field" data-field="displayName" hidden>
            <span>Ad</span>
            <input name="displayName" required minlength="2" maxlength="40" />
          </label>
          <label class="auth-field">
            <span>E-posta</span>
            <input name="email" type="email" required autocomplete="email" />
          </label>
          <label class="auth-field">
            <span>Şifre</span>
            <input name="password" type="password" required minlength="6" autocomplete="current-password" />
          </label>
          <p class="auth-error" role="alert" hidden></p>
          <button type="submit" class="btn-primary">Gönder</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let mode: 'login' | 'register' = 'login';
  const title = modal.querySelector<HTMLHeadingElement>('#auth-title')!;
  const errorEl = modal.querySelector<HTMLParagraphElement>('.auth-error')!;
  const nameField = modal.querySelector<HTMLLabelElement>('[data-field="displayName"]')!;

  const close = (): void => modal.remove();
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelectorAll<HTMLButtonElement>('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      mode = tab.dataset.tab as 'login' | 'register';
      modal.querySelectorAll('.auth-tab').forEach((t) => t.classList.toggle('active', t === tab));
      title.textContent = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
      nameField.hidden = mode === 'login';
      errorEl.hidden = true;
    });
  });

  modal.querySelector<HTMLFormElement>('#auth-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');

    const result = mode === 'login'
      ? await login(auth, email, password)
      : await register(auth, db, email, password, String(fd.get('displayName') ?? ''));

    if (result.ok) {
      close();
      onSuccess();
    } else {
      errorEl.textContent = result.error.message;
      errorEl.hidden = false;
    }
  });
}