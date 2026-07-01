import { db } from '../../config/firebase';
import { listBlockedUsers } from '../../services/adminUsers.service';
import { unblockUser } from '../../services/admin.service';
import { confirmAction } from './shared/ConfirmDialog';
import type { BlockedUser } from '../../services/adminUsers.service';

export async function renderUsersTab(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const result = await listBlockedUsers(db);
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
    empty.textContent = 'Engellenmiş kullanıcı yok.';
    container.appendChild(empty);
    return;
  }

  for (const u of result.data) {
    const card = document.createElement('article');
    card.className = 'user-admin-card';

    const uid = document.createElement('strong');
    uid.textContent = u.uid;
    card.appendChild(uid);

    const meta = document.createElement('p');
    const blockedDate = u.blockedAt?.toDate?.() ?? new Date();
    meta.textContent = `Engellenmiş: ${blockedDate.toLocaleString('tr')}`;
    card.appendChild(meta);

    if (u.reason) {
      const reason = document.createElement('p');
      reason.textContent = `Sebep: ${u.reason}`;
      card.appendChild(reason);
    }

    const unblockBtn = document.createElement('button');
    unblockBtn.type = 'button';
    unblockBtn.className = 'btn btn-secondary';
    unblockBtn.textContent = 'Engeli Kaldır';
    unblockBtn.addEventListener('click', async () => {
      const ok = await confirmAction(`${u.uid} için engeli kaldır?`);
      if (!ok) return;
      const res = await unblockUser(u.uid);
      if (res.ok) {
        card.remove();
      } else {
        alert(res.error.message);
      }
    });

    card.appendChild(unblockBtn);
    container.appendChild(card);
  }
}