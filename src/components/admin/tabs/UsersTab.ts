import { db } from '../../../config/firebase';
import { renderListView, type ListViewConfig } from '../shared/ListView';
import { confirm } from '../shared/ConfirmDialog';
import { listBlockedUsers } from '../../../services/adminUsers.service';
import { blockUser, unblockUser } from '../../../services/admin.service';
import type { BlockedUser } from '../../../services/adminUsers.service';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { COLLECTIONS } from '../../../config/constants';
import type { UserProfile } from '../../../types/models';

interface UserRow extends UserProfile {
  id: string;
  isBlocked: boolean;
  blockInfo?: BlockedUser;
}

export async function renderUsersTab(container: HTMLElement): Promise<void> {
  const blockedResult = await listBlockedUsers(db);
  const blockedMap = new Map<string, BlockedUser>();
  if (blockedResult.ok && blockedResult.data) {
    for (const b of blockedResult.data) blockedMap.set(b.uid, b);
  }

  const config: ListViewConfig<UserRow> = {
    columns: [
      { key: 'name', label: 'Kullanıcı', render: u => u.displayName },
      { key: 'email', label: 'E-posta', render: u => u.email },
      { key: 'role', label: 'Rol', render: u => u.role },
      { key: 'contributions', label: 'Katkılar', render: u => String(u.contributionCount ?? 0) },
      { key: 'status', label: 'Durum', render: u => u.isBlocked ? 'Engellenmiş' : 'Aktif' },
    ],
    actions: [
      {
        label: 'Engelle', variant: 'danger',
        isVisible: u => !u.isBlocked,
        onClick: async (u) => {
          if (!await confirm({ title: 'Kullanıcı engellensin mi?', message: u.displayName, variant: 'danger' })) return;
          const r = await blockUser(u.id, 'admin moderation');
          if (r.ok) await renderUsersTab(container);
        },
      },
      {
        label: 'Engeli Kaldır', variant: 'secondary',
        isVisible: u => u.isBlocked,
        onClick: async (u) => {
          if (!await confirm({ title: 'Engel kaldırılsın mı?', message: u.displayName })) return;
          const r = await unblockUser(u.id);
          if (r.ok) await renderUsersTab(container);
        },
      },
    ],
    filters: [
      {
        key: 'status', label: 'Durum', type: 'select',
        options: [
          { value: 'all', label: 'Hepsi' },
          { value: 'active', label: 'Aktif' },
          { value: 'blocked', label: 'Engellenmiş' },
        ],
      },
      { key: 'q', label: 'Ara', type: 'text' },
    ],
    fetch: async (filterValues) => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.USERS), orderBy('displayName'), limit(50)));
        let items: UserRow[] = snap.docs.map(d => {
          const data = d.data() as UserProfile;
          const blockInfo = blockedMap.get(d.id);
          return {
            id: d.id,
            ...data,
            isBlocked: blockedMap.has(d.id),
            ...(blockInfo ? { blockInfo } : {}),
          };
        });
        if (filterValues.status === 'active') items = items.filter(u => !u.isBlocked);
        if (filterValues.status === 'blocked') items = items.filter(u => u.isBlocked);
        if (filterValues.q) {
          const q = filterValues.q.toLowerCase();
          items = items.filter(u => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        }
        return { ok: true, data: { items, hasMore: false } };
      } catch (err) {
        return { ok: false, error: { code: 'users/list-failed', message: 'Kullanıcılar yüklenemedi.' } };
      }
    },
    emptyMessage: 'Hiç kullanıcı yok.',
  };
  await renderListView(container, config);
}