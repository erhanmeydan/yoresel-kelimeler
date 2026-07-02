import { db } from '../../../config/firebase';
import { renderListView, type ListViewConfig } from '../shared/ListView';
import { confirm } from '../shared/ConfirmDialog';
import { listEntries, softDeleteEntry, restoreEntry } from '../../../services/admin/entriesModeration.service';
import type { Entry } from '../../../types/models';

export async function renderEntriesTab(container: HTMLElement): Promise<void> {
  const config: ListViewConfig<Entry> = {
    columns: [
      { key: 'word', label: 'Kelime', render: e => e.word },
      { key: 'meaning', label: 'Anlam', render: e => e.meaning.slice(0, 80) },
      { key: 'region', label: 'İl', render: e => e.regionId },
      { key: 'date', label: 'Tarih', render: e => new Date(e.createdAt.toMillis()).toLocaleDateString('tr-TR') },
      { key: 'status', label: 'Durum', render: e => e.status === 'removed' ? 'Silinmiş' : 'Aktif' },
    ],
    actions: [
      {
        label: 'Sil', variant: 'danger',
        isVisible: e => e.status !== 'removed',
        onClick: async (e) => {
          if (!await confirm({ title: 'Entry silinsin mi?', message: e.word, variant: 'danger' })) return;
          const r = await softDeleteEntry(e.id!, 'admin moderation');
          if (r.ok) await renderEntriesTab(container);
        },
      },
      {
        label: 'Geri Al', variant: 'secondary',
        isVisible: e => e.status === 'removed',
        onClick: async (e) => {
          if (!await confirm({ title: 'Entry geri alınsın mı?', message: e.word })) return;
          const r = await restoreEntry(e.id!);
          if (r.ok) await renderEntriesTab(container);
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
      // NOTE: `regionId` text input is forwarded to `listEntries` as a
      // Firestore `==` (exact match) query only. Substring/prefix search is
      // not supported without a different index strategy. Tracked as a
      // Phase 4 follow-up.
      { key: 'regionId', label: 'İl kodu', type: 'text' },
    ],
    fetch: async (filterValues) => {
      const rawStatus = filterValues.status;
      const status: 'active' | 'removed' | undefined =
        !rawStatus || rawStatus === 'all' ? undefined : (rawStatus as 'active' | 'removed');
      const regionId = filterValues.regionId || undefined;
      const filters: { status?: 'active' | 'removed'; regionId?: string } = {};
      if (status) filters.status = status;
      if (regionId) filters.regionId = regionId;
      const r = await listEntries(db, filters);
      if (!r.ok) return { ok: false, error: r.error };
      if (!r.data) return { ok: false, error: { code: 'admin/no-data', message: 'Veri yok.' } };
      return { ok: true, data: r.data };
    },
    emptyMessage: 'Hiç entry yok.',
  };
  await renderListView(container, config);
}