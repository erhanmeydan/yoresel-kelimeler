import { db, auth } from '../config/firebase';
import { createEntry, getEntry, updateOwnEntry, listAllSlugs } from '../services/entries.service';
import { listRegions } from '../services/regions.service';
import { validateEntry } from '../utils/validation';
import { sanitizeText } from '../utils/sanitize';
import { generateUniqueSlug } from '../utils/slug';
import type { EntryType, Region, Entry } from '../types/models';

export interface EntryFormOptions {
  entryId?: string;
}

export async function renderEntryForm(
  container: HTMLElement,
  options: EntryFormOptions = {},
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    container.innerHTML = '<p>Katkıda bulunmak için giriş yapmalısınız.</p>';
    return;
  }

  const [regionsResult, existingResult] = await Promise.all([
    listRegions(db),
    options.entryId ? getEntry(db, options.entryId) : Promise.resolve(null),
  ]);

  if (!regionsResult.ok) {
    container.replaceChildren();
    const errP = document.createElement('p');
    errP.className = 'error';
    errP.textContent = regionsResult.error.message;
    container.appendChild(errP);
    return;
  }
  const regions = regionsResult.data;
  const existing: Entry | null = (existingResult && existingResult.ok) ? existingResult.data : null;

  if (options.entryId && !existing) {
    container.replaceChildren();
    const errP = document.createElement('p');
    errP.className = 'error';
    errP.textContent = 'Kayıt bulunamadı veya düzenleme yetkiniz yok.';
    container.appendChild(errP);
    return;
  }

  const isEdit = existing !== null;

  container.innerHTML = `
    <header class="page-header">
      <h1>${isEdit ? 'Kaydı Düzenle' : 'Yeni Sözcük Ekle'}</h1>
      <p class="lead">
        ${isEdit
          ? 'Mevcut kaydı güncelleyin. Değişiklikler hemen yayına alınır.'
          : 'Yörenizden bir kelime, deyim ya da atasözü ekleyin. Eklediğiniz her kayıt, kültürel arşive kalıcı olarak katılır.'}
      </p>
    </header>
    <form class="entry-form" novalidate>
      <h2>Sözcük Bilgileri</h2>

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
        <select name="regionId" required></select>
        ${isEdit ? '<small class="hint">İl değiştirilebilir.</small>' : ''}
      </label>

      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Kaydet' : 'Gönder'}</button>
        ${isEdit
          ? '<a class="btn-link" href="/profile"><span class="arrow">←</span> Profile dön</a>'
          : '<a class="btn-link" href="/"><span class="arrow">←</span> Haritaya dön</a>'}
      </div>
    </form>
  `;

  // Populate il <option>s via DOM (no innerHTML) so region names cannot inject markup (#11).
  const regionSelect = container.querySelector<HTMLSelectElement>('select[name="regionId"]')!;
  for (const r of regions as Region[]) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.name} (${r.parentRegion})`;
    regionSelect.appendChild(opt);
  }

  // Pre-fill on edit
  if (isEdit && existing) {
    const form = container.querySelector<HTMLFormElement>('.entry-form')!;
    form.querySelector<HTMLSelectElement>('select[name="type"]')!.value = existing.type;
    (form.querySelector<HTMLInputElement>('input[name="word"]')! as HTMLInputElement).value = existing.word;
    (form.querySelector<HTMLTextAreaElement>('textarea[name="meaning"]')! as HTMLTextAreaElement).value = existing.meaning;
    (form.querySelector<HTMLTextAreaElement>('textarea[name="exampleSentence"]')! as HTMLTextAreaElement).value = existing.exampleSentence ?? '';
    form.querySelector<HTMLSelectElement>('select[name="regionId"]')!.value = existing.regionId;
    // Update char counters after pre-fill
    updateCharCounters(form);
  }

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

    if (isEdit && existing) {
      const result = await updateOwnEntry(db, existing.id, {
        type: input.type,
        word: input.word,
        meaning: input.meaning,
        exampleSentence: input.exampleSentence,
        regionId: input.regionId,
      });
      if (result.ok) {
        errorEl.classList.add('success');
        errorEl.textContent = '✓ Kayıt güncellendi!';
        errorEl.hidden = false;
      } else {
        errorEl.textContent = result.error.message;
        errorEl.hidden = false;
      }
    } else {
      const existingSlugs = await listAllSlugs(db);
      const slug = generateUniqueSlug(input.word, existingSlugs);
      const result = await createEntry(db, {
        ...input,
        slug,
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
    }
    submitBtn.disabled = false;
  });
}

function updateCharCounters(form: HTMLFormElement): void {
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[maxlength]').forEach((input) => {
    const counter = input.parentElement!.querySelector('.char-counter')!;
    counter.textContent = `${input.value.length} / ${input.maxLength}`;
  });
}