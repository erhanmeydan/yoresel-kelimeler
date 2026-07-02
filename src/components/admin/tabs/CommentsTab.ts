import { db } from '../../../config/firebase';
import { renderListView, type ListViewConfig } from '../shared/ListView';
import { confirm } from '../shared/ConfirmDialog';
import { listAllComments, deleteComment, restoreComment } from '../../../services/admin/admin.service';
import type { Comment } from '../../../types/models';

export async function renderCommentsTab(container: HTMLElement): Promise<void> {
  const config: ListViewConfig<Comment> = {
    columns: [
      { key: 'author', label: 'Yazar', render: c => c.authorName },
      { key: 'text', label: 'Yorum', render: c => document.createTextNode(c.text) as unknown as HTMLElement },
      { key: 'date', label: 'Tarih', render: c => new Date(c.createdAt.toMillis()).toLocaleDateString('tr-TR') },
      { key: 'status', label: 'Durum', render: c => c.status === 'removed' ? 'Silinmiş' : 'Aktif' },
    ],
    actions: [
      {
        label: 'Sil', variant: 'danger',
        isVisible: c => c.status !== 'removed',
        onClick: async (c) => {
          if (!await confirm({ title: 'Yorumu sil?', message: c.text.slice(0, 100), variant: 'danger' })) return;
          const r = await deleteComment(c.id!);
          if (r.ok) {
            await renderCommentsTab(container);
          } else {
            alert(`Silinemedi: ${r.error?.message ?? 'bilinmeyen hata'} (${r.error?.code ?? ''})`);
          }
        },
      },
      {
        label: 'Geri Al', variant: 'secondary',
        isVisible: c => c.status === 'removed',
        onClick: async (c) => {
          if (!await confirm({ title: 'Yorumu geri al?', message: c.text.slice(0, 100) })) return;
          const r = await restoreComment(c.id!);
          if (r.ok) {
            await renderCommentsTab(container);
          } else {
            alert(`Geri alınamadı: ${r.error?.message ?? 'bilinmeyen hata'} (${r.error?.code ?? ''})`);
          }
        },
      },
    ],
    filters: [
      {
        key: 'status', label: 'Durum', type: 'select',
        options: [
          { value: 'all', label: 'Hepsi' },
          { value: 'active', label: 'Aktif' },
          { value: 'removed', label: 'Silinmiş' },
        ],
      },
      { key: 'q', label: 'Ara', type: 'text' },
    ],
    // Client-side text search: filter on `text` and `authorName`.
    // Service stays simple (status filter only); search filter is applied
    // in-memory after the Firestore fetch. Best-effort for moderate dataset.
    fetch: async (filterValues) => {
      const rawStatus = filterValues.status;
      const status: 'active' | 'removed' | undefined =
        !rawStatus || rawStatus === 'all' ? undefined : (rawStatus as 'active' | 'removed');
      const r = await listAllComments(db, status ? { status } : {});
      if (!r.ok) return { ok: false, error: r.error };
      if (!r.data) return { ok: false, error: { code: 'admin/no-data', message: 'Veri yok.' } };
      let items = r.data.items;
      const q = filterValues.q?.trim().toLowerCase();
      if (q) {
        items = items.filter((c) =>
          c.text.toLowerCase().includes(q) ||
          c.authorName.toLowerCase().includes(q)
        );
      }
      return { ok: true, data: { items, hasMore: false } };
    },
    emptyMessage: 'Hiç yorum yok.',
  };
  await renderListView(container, config);
}