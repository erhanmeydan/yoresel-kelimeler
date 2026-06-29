import { auth, db } from '../config/firebase';
import { getProfile } from '../services/auth.service';
import { listOwnEntries, deleteOwnEntry, getEntry } from '../services/entries.service';
import { listRegions } from '../services/regions.service';
import { listOwnComments, deleteComment } from '../services/comments.service';
import { renderEntryCard } from '../components/EntryCard';
import type { Comment, Entry, Region, UserProfile } from '../types/models';

function renderAuthPrompt(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'page-container';
  const h = document.createElement('h1');
  h.textContent = 'Profil';
  const p = document.createElement('p');
  p.className = 'lead';
  p.textContent = 'Katkılarınızı görmek için giriş yapın.';
  const a = document.createElement('a');
  a.className = 'btn btn-primary';
  a.href = '/';
  a.textContent = '← Haritaya dön';
  wrap.append(h, p, a);
  return wrap;
}

function renderEmptyState(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'panel-empty';
  const mark = document.createElement('div');
  mark.className = 'panel-empty-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '+';
  const h = document.createElement('h2');
  h.className = 'panel-empty-title';
  h.textContent = 'Henüz katkı yok';
  const p = document.createElement('p');
  p.className = 'panel-empty-text';
  p.textContent = 'Yörenizden bir kelime, deyim ya da atasözü ekleyerek arşive katkıda bulunun.';
  const a = document.createElement('a');
  a.className = 'btn btn-primary';
  a.href = '/contribute';
  a.textContent = 'Sözcük ekle';
  wrap.append(mark, h, p, a);
  return wrap;
}

function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return '';
  return ts.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function appendBackLink(container: HTMLElement): void {
  const p = document.createElement('p');
  p.style.marginTop = 'var(--space-6)';
  const a = document.createElement('a');
  a.className = 'btn-link';
  a.href = '/';
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = '←';
  a.append(arrow, document.createTextNode(' Haritaya dön'));
  p.appendChild(a);
  container.appendChild(p);
}

function renderEntryList(
  entries: Entry[],
  regionNameById: Map<string, string>,
  onChange: () => void,
): HTMLElement {
  const list = document.createElement('div');
  list.className = 'entries-list';
  list.setAttribute('aria-label', 'Katkılarım');

  if (entries.length === 0) {
    list.appendChild(renderEmptyState());
    return list;
  }

  for (const entry of entries) {
    const wrapper = document.createElement('div');
    wrapper.className = 'profile-entry';

    const card = renderEntryCard(entry, regionNameById.get(entry.regionId));
    wrapper.appendChild(card);

    const actions = document.createElement('div');
    actions.className = 'profile-entry-actions';

    const editLink = document.createElement('a');
    editLink.className = 'btn btn-secondary btn-sm';
    editLink.href = `/contribute?edit=${encodeURIComponent(entry.id)}`;
    editLink.textContent = 'Düzenle';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-ghost btn-sm btn-danger';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Sil';
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm(`"${entry.word}" kaydını silmek istediğinize emin misiniz?`)) return;
      deleteBtn.disabled = true;
      const result = await deleteOwnEntry(db, entry.id);
      if (result.ok) {
        wrapper.remove();
        onChange();
      } else {
        window.alert(result.error.message);
        deleteBtn.disabled = false;
      }
    });

    actions.append(editLink, deleteBtn);
    wrapper.appendChild(actions);
    list.appendChild(wrapper);
  }

  return list;
}

function renderCommentsSection(
  comments: Comment[],
  entryWordById: Map<string, string>,
  entrySlugById: Map<string, string>,
  onChange: () => void,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'profile-comments';

  const h = document.createElement('h2');
  h.className = 'profile-section-title';
  h.textContent = `Yorumlarım (${comments.length})`;
  section.appendChild(h);

  if (comments.length === 0) {
    const p = document.createElement('p');
    p.className = 'comments-empty';
    p.textContent = 'Henüz yorum yapmadınız.';
    section.appendChild(p);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'profile-comments-list';

  for (const c of comments) {
    const li = document.createElement('li');
    li.className = 'profile-comment';

    const top = document.createElement('div');
    top.className = 'profile-comment-top';
    const link = document.createElement('a');
    link.className = 'profile-comment-word';
    link.href = `/entry/${encodeURIComponent(entrySlugById.get(c.entryId) ?? c.entryId)}`;
    const wordText = entryWordById.get(c.entryId);
    link.textContent = wordText ?? '—';
    const date = document.createElement('span');
    date.className = 'comment-time';
    date.textContent = formatDate(c.createdAt);
    top.append(link, date);

    const text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = c.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-ghost btn-sm btn-danger';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Sil';
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm('Bu yorumu silmek istediğinize emin misiniz?')) return;
      deleteBtn.disabled = true;
      const result = await deleteComment(db, c.id);
      if (result.ok) {
        li.remove();
        onChange();
      } else {
        window.alert(result.error.message);
        deleteBtn.disabled = false;
      }
    });

    li.append(top, text, deleteBtn);
    list.appendChild(li);
  }

  section.appendChild(list);
  return section;
}

export async function renderProfilePage(container: HTMLElement): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    container.replaceChildren(renderAuthPrompt());
    return;
  }

  const profileResult = await getProfile(db, user.uid);
  const profile: UserProfile | null = profileResult.ok ? profileResult.data : null;
  const displayName = profile?.displayName ?? user.displayName ?? user.email ?? 'Profil';

  const page = document.createElement('div');
  page.className = 'page-container profile-page';

  const header = document.createElement('header');
  header.className = 'page-header';
  const h1 = document.createElement('h1');
  h1.textContent = displayName;
  header.appendChild(h1);
  page.appendChild(header);

  // Sections containers — populated on each refresh
  const sectionsHost = document.createElement('div');
  page.appendChild(sectionsHost);

  // Back link
  appendBackLink(page);

  container.replaceChildren(page);

  async function refresh(): Promise<void> {
    if (!user) return;
    const uid = user.uid;
    const [regionsResult, entriesResult, commentsResult] = await Promise.all([
      listRegions(db),
      listOwnEntries(db, uid),
      listOwnComments(db, uid),
    ]);
    const regions: Region[] = regionsResult.ok ? regionsResult.data : [];
    const regionNameById = new Map(regions.map((r) => [r.id, r.name]));
    const entries: Entry[] = entriesResult.ok ? entriesResult.data : [];
    const comments: Comment[] = commentsResult.ok ? commentsResult.data : [];

    // Lookup entry words and slugs for comment links (parallel, deduped)
    const uniqueEntryIds = [...new Set(comments.map((c) => c.entryId))];
    const entryResults = await Promise.all(uniqueEntryIds.map((id) => getEntry(db, id)));
    const entryWordById = new Map<string, string>();
    const entrySlugById = new Map<string, string>();
    entryResults.forEach((r) => {
      if (r.ok) {
        entryWordById.set(r.data.id, r.data.word);
        entrySlugById.set(r.data.id, r.data.slug);
      }
    });

    // Lead text
    const lead = document.createElement('p');
    lead.className = 'lead';
    lead.textContent = `${entries.length} katkı · ${comments.length} yorum · topluluk arşivine katkı`;

    // Sections
    const entriesSection = document.createElement('section');
    const entriesTitle = document.createElement('h2');
    entriesTitle.className = 'profile-section-title';
    entriesTitle.textContent = `Katkılarım (${entries.length})`;
    entriesSection.appendChild(entriesTitle);
    const entriesList = renderEntryList(entries, regionNameById, refresh);
    entriesSection.appendChild(entriesList);

    const commentsSection = renderCommentsSection(comments, entryWordById, entrySlugById, refresh);

    sectionsHost.replaceChildren(lead, entriesSection, commentsSection);
  }

  await refresh();
}