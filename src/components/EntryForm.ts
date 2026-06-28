import { db, auth } from '../config/firebase';
import { createEntry } from '../services/entries.service';
import { listRegions } from '../services/regions.service';
import { validateEntry } from '../utils/validation';
import { sanitizeText } from '../utils/sanitize';
import type { EntryType, Region } from '../types/models';

export async function renderEntryForm(container: HTMLElement): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    container.innerHTML = '<p>Katkıda bulunmak için giriş yapmalısınız.</p>';
    return;
  }

  const regionsResult = await listRegions(db);
  if (!regionsResult.ok) {
    container.innerHTML = `<p class="error">${regionsResult.error.message}</p>`;
    return;
  }
  const regions = regionsResult.data;

  container.innerHTML = `
    <form class="entry-form" novalidate>
      <h2>Yeni Kelime / Deyim Ekle</h2>

      <label class="form-field">
        <span>Tür *</span>
        <select name="type" required>
          <option value="kelime">Kelime</option>
          <option value="deyim">Deyim</option>
          <option value="atasözü">Atasözü</option>
        </select>
      </label>

      <label class="form-field">
        <span>Kelime / Deyim *</span>
        <input name="word" required maxlength="100" />
        <small class="char-counter">0 / 100</small>
      </label>

      <label class="form-field">
        <span>Anlam *</span>
        <textarea name="meaning" required maxlength="500" rows="3"></textarea>
        <small class="char-counter">0 / 500</small>
      </label>

      <label class="form-field">
        <span>Örnek Cümle</span>
        <textarea name="exampleSentence" maxlength="500" rows="2"></textarea>
        <small class="char-counter">0 / 500</small>
      </label>

      <label class="form-field">
        <span>İl *</span>
        <select name="regionId" required>
          <option value="">Seçin...</option>
          ${regions.map((r: Region) => `<option value="${r.id}">${r.name} (${r.parentRegion})</option>`).join('')}
        </select>
      </label>

      <p class="form-error" role="alert" hidden></p>
      <button type="submit" class="btn-primary">Gönder</button>
    </form>
  `;

  const form = container.querySelector<HTMLFormElement>('.entry-form')!;
  const errorEl = container.querySelector<HTMLParagraphElement>('.form-error')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;

  // Karakter sayaçları
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[maxlength]').forEach((input) => {
    const counter = input.parentElement!.querySelector('.char-counter')!;
    input.addEventListener('input', () => { counter.textContent = `${input.value.length} / ${input.maxLength}`; });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;

    const fd = new FormData(form);
    const input = {
      type: String(fd.get('type')) as EntryType,
      word: sanitizeText(String(fd.get('word') ?? '')),
      meaning: sanitizeText(String(fd.get('meaning') ?? '')),
      exampleSentence: sanitizeText(String(fd.get('exampleSentence') ?? '')),
      regionId: String(fd.get('regionId') ?? ''),
    };

    const validation = validateEntry(input);
    if (!validation.ok) {
      errorEl.textContent = validation.errors.map((er) => er.message).join(' ');
      errorEl.hidden = false;
      submitBtn.disabled = false;
      return;
    }

    const result = await createEntry(db, {
      ...input,
      contributorId: user.uid,
      contributorName: user.displayName ?? user.email ?? 'Anonim',
    });

    if (result.ok) {
      form.reset();
      errorEl.classList.add('success');
      errorEl.textContent = '✓ Kayıt eklendi! Haritadan görebilirsiniz.';
      errorEl.hidden = false;
    } else {
      errorEl.textContent = result.error.message;
      errorEl.hidden = false;
    }
    submitBtn.disabled = false;
  });
}
