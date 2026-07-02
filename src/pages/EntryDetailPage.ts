import { auth, db } from '../config/firebase';
import { getEntryBySlug, likeEntry, unlikeEntry, hasLiked, deleteOwnEntry } from '../services/entries.service';
import { listRegions } from '../services/regions.service';
import { addComment, listComments } from '../services/comments.service';
import { showAuthDrawer } from '../components/AuthDrawer';
import { renderReportButton } from '../components/ReportButton';
import { ENTRY_TYPE_LABELS } from '../config/constants';
import { sanitizeText } from '../utils/sanitize';
import { navigate } from '../utils/navigate';
import type { Comment, Entry, Region } from '../types/models';

const TYPE_LABELS: Record<Entry['type'], string> = ENTRY_TYPE_LABELS;

function formatTimestamp(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return '';
  const date = ts.toDate();
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderBackLink(): HTMLElement {
  const p = document.createElement('p');
  const a = document.createElement('a');
  a.className = 'btn-link';
  a.href = '/';
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = '←';
  a.append(arrow, document.createTextNode(' Haritaya dön'));
  p.appendChild(a);
  return p;
}

function renderEmptyState(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'page-container';
  const h = document.createElement('h1');
  h.textContent = 'Kayıt bulunamadı';
  const p = document.createElement('p');
  p.className = 'lead';
  p.textContent = 'Aradığınız kayıt silinmiş veya hiç var olmamış olabilir.';
  wrap.append(h, p, renderBackLink());
  return wrap;
}

function renderError(message: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'page-container';
  const h = document.createElement('h1');
  h.textContent = 'Bir hata oluştu';
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = message;
  wrap.append(h, p, renderBackLink());
  return wrap;
}

export async function renderEntryDetailPage(
  container: HTMLElement, slug: string,
): Promise<void> {
  const entryResult = await getEntryBySlug(db, slug);
  if (!entryResult.ok) {
    if (entryResult.error.code === 'entries/not-found') {
      container.replaceChildren(renderEmptyState());
    } else {
      container.replaceChildren(renderError(entryResult.error.message));
    }
    return;
  }

  const entry = entryResult.data;
  const entryId = entry.id;

  const [regionsResult, commentsResult] = await Promise.all([
    listRegions(db),
    listComments(db, entryId),
  ]);
  const regions: Region[] = regionsResult.ok ? regionsResult.data : [];
  const regionName = regions.find((r) => r.id === entry.regionId)?.name ?? entry.regionId;
  const initialComments: Comment[] = commentsResult.ok ? commentsResult.data : [];

  const page = document.createElement('div');
  page.className = 'page-container entry-detail';

  const back = renderBackLink();
  page.appendChild(back);

  // Eyebrow
  const eyebrow = document.createElement('span');
  eyebrow.className = 'entry-type-label';
  eyebrow.textContent = TYPE_LABELS[entry.type];
  page.appendChild(eyebrow);

  // Word — hero
  const word = document.createElement('h1');
  word.className = `entry-detail-word entry-detail-word--${entry.type}`;
  word.textContent = entry.word;
  page.appendChild(word);

  // Meaning
  const meaning = document.createElement('p');
  meaning.className = 'entry-detail-meaning';
  meaning.textContent = entry.meaning;
  page.appendChild(meaning);

  // Example sentence
  if (entry.exampleSentence) {
    const example = document.createElement('blockquote');
    example.className = 'entry-detail-example';
    example.textContent = `“${entry.exampleSentence}”`;
    page.appendChild(example);
  }

  // Divider
  const divider = document.createElement('hr');
  divider.className = 'entry-detail-divider';
  page.appendChild(divider);

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'entry-detail-meta';
  const regionSpan = document.createElement('span');
  const regionStrong = document.createElement('strong');
  regionStrong.textContent = regionName;
  regionSpan.appendChild(regionStrong);
  const dateSpan = document.createElement('span');
  dateSpan.textContent = formatTimestamp(entry.createdAt);
  meta.append(regionSpan, document.createTextNode(' · '), dateSpan);
  page.appendChild(meta);

  // Actions: like + report
  const actions = document.createElement('div');
  actions.className = 'entry-detail-actions';

  const likeBtn = document.createElement('button');
  likeBtn.className = 'btn-like';
  likeBtn.type = 'button';
  let currentLikes = entry.likeCount;
  let liked = false;
  const renderLike = (): void => {
    likeBtn.classList.toggle('liked', liked);
    likeBtn.setAttribute('aria-pressed', String(liked));
    likeBtn.innerHTML = `<span class="like-heart">♥</span> <span class="like-count">${currentLikes}</span>`;
  };
  renderLike();
  // Reflect the signed-in user's existing like (if any) on load.
  const likeUser = auth.currentUser;
  if (likeUser) {
    void hasLiked(db, entryId, likeUser.uid).then((alreadyLiked) => {
      if (alreadyLiked) { liked = true; renderLike(); }
    });
  }
  likeBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showAuthDrawer('login');
      return;
    }
    likeBtn.disabled = true;
    if (liked) {
      // Optimistic unlike; likeCount on the entry settles via Cloud Function.
      liked = false;
      currentLikes = Math.max(0, currentLikes - 1);
      renderLike();
      const result = await unlikeEntry(db, entryId, user.uid);
      if (!result.ok) {
        liked = true;
        currentLikes += 1;
        renderLike();
      }
    } else {
      liked = true;
      currentLikes += 1;
      renderLike();
      const result = await likeEntry(db, entryId, user.uid);
      if (!result.ok) {
        liked = false;
        currentLikes = Math.max(0, currentLikes - 1);
        renderLike();
      }
    }
    likeBtn.disabled = false;
  });
  actions.appendChild(likeBtn);

  const reportSlot = document.createElement('div');
  actions.appendChild(reportSlot);
  renderReportButton(reportSlot, entryId);

  // Owner actions: Düzenle / Sil
  const currentUser = auth.currentUser;
  const isOwner = currentUser?.uid === entry.contributorId;
  if (isOwner) {
    const ownerActions = document.createElement('div');
    ownerActions.className = 'entry-detail-owner-actions';

    const editLink = document.createElement('a');
    editLink.className = 'btn btn-secondary btn-sm';
    editLink.href = `/contribute?edit=${encodeURIComponent(entryId)}`;
    editLink.textContent = 'Düzenle';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-ghost btn-sm btn-danger';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Sil';
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm(`"${entry.word}" kaydını silmek istediğinize emin misiniz?`)) return;
      deleteBtn.disabled = true;
      const result = await deleteOwnEntry(db, entryId);
      if (result.ok) {
        navigate('/profile');
      } else {
        window.alert(result.error.message);
        deleteBtn.disabled = false;
      }
    });

    ownerActions.append(editLink, deleteBtn);
    actions.appendChild(ownerActions);
  }

  page.appendChild(actions);

  // Comments section
  const commentsHeader = document.createElement('h2');
  commentsHeader.className = 'entry-detail-comments-title';
  commentsHeader.textContent = 'Yorumlar';
  page.appendChild(commentsHeader);

  const commentsList = document.createElement('div');
  commentsList.className = 'comments-list';
  commentsList.setAttribute('aria-label', 'Yorumlar');

  function renderComments(list: Comment[]): void {
    commentsList.replaceChildren();
    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'comments-empty';
      empty.textContent = 'Henüz yorum yok. İlk yorumu sen yaz.';
      commentsList.appendChild(empty);
      return;
    }
    for (const c of list) {
      const article = document.createElement('article');
      article.className = 'comment';
      const header = document.createElement('div');
      header.className = 'comment-header';
      const author = document.createElement('strong');
      author.textContent = c.authorName;
      const time = document.createElement('span');
      time.className = 'comment-time';
      time.textContent = formatTimestamp(c.createdAt);
      header.append(author, time);
      const body = document.createElement('p');
      body.className = 'comment-text';
      body.textContent = c.text;
      article.append(header, body);
      commentsList.appendChild(article);
    }
  }
  renderComments(initialComments);
  page.appendChild(commentsList);

  // Comment form
  const form = document.createElement('form');
  form.className = 'comment-form';

  const input = document.createElement('textarea');
  input.name = 'text';
  input.placeholder = 'Yorumunuzu yazın…';
  input.rows = 3;
  input.maxLength = 500;
  input.required = true;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn btn-primary';
  submit.textContent = 'Gönder';

  const formError = document.createElement('p');
  formError.className = 'error';
  formError.hidden = true;

  form.append(input, submit, formError);
  page.appendChild(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      showAuthDrawer('login');
      return;
    }
    const text = sanitizeText(input.value);
    if (!text) return;
    submit.disabled = true;
    formError.hidden = true;

    const result = await addComment(db, entryId, user.uid, user.displayName ?? user.email ?? 'Kullanıcı', text);
    if (result.ok) {
      input.value = '';
      // Optimistic insert: show immediately, refresh from Firestore in background.
      const optimistic: Comment = {
        id: result.data,
        entryId,
        authorId: user.uid,
        authorName: user.displayName ?? user.email ?? 'Kullanıcı',
        text,
        createdAt: { toDate: () => new Date() } as Comment['createdAt'],
      };
      const currentList = Array.from(commentsList.querySelectorAll('.comment'))
        .map((el) => el as HTMLElement);
      // Rebuild from optimistic + existing cards (cheaper than maintaining a parallel array)
      renderComments([
        optimistic,
        ...initialComments.filter((c) => c.id !== result.data),
      ]);
      void listComments(db, entryId).then((refresh) => {
        if (refresh.ok) renderComments(refresh.data);
      });
    } else {
      formError.textContent = result.error.message;
      formError.hidden = false;
    }
    submit.disabled = false;
  });

  container.replaceChildren(page);
}