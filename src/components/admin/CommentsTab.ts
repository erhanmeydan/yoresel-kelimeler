import { db } from '../../config/firebase';
import { listAllComments } from '../../services/commentsModeration.service';
import { deleteComment } from '../../services/admin.service';
import { confirmAction } from './shared/ConfirmDialog';
import type { Comment } from '../../types/models';

export async function renderCommentsTab(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const result = await listAllComments(db, 50);
  if (!result.ok) {
    const err = document.createElement('p');
    err.className = 'error';
    err.textContent = result.error.message;
    container.appendChild(err);
    return;
  }

  if (result.data.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Hiç yorum yok.';
    container.appendChild(empty);
    return;
  }

  for (const c of result.data) {
    const card = document.createElement('article');
    card.className = 'comment-admin-card';

    const author = document.createElement('strong');
    author.textContent = c.authorName;
    card.appendChild(author);

    const text = document.createElement('p');
    text.textContent = c.text;
    card.appendChild(text);

    const date = document.createElement('time');
    date.textContent = new Date(c.createdAt.toMillis?.() ?? Date.now()).toLocaleString('tr');
    card.appendChild(date);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Sil';
    delBtn.setAttribute('aria-label', `Yorumu sil: ${c.text.slice(0, 50)}`);
    delBtn.addEventListener('click', async () => {
      const ok = await confirmAction('Bu yorumu silmek istediğinizden emin misiniz?');
      if (!ok) return;
      const id = c.id ?? '';
      const res = await deleteComment(id);
      if (res.ok) {
        card.remove();
      } else {
        alert(res.error.message);
      }
    });

    card.appendChild(delBtn);
    container.appendChild(card);
  }
}
