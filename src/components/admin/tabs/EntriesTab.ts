import { db } from '../../../config/firebase';
import { renderListView, type ListViewConfig } from '../shared/ListView';
import { confirm } from '../shared/ConfirmDialog';
import { listEntries, softDeleteEntry, restoreEntry } from '../../../services/admin/entriesModeration.service';
import { listRegions } from '../../../services/regions.service';
import type { Entry } from '../../../types/models';

export async function renderEntriesTab(container: HTMLElement): Promise<void> {
  // Pre-load regions for name → id lookup. Cheap (81 docs) and avoids
  // re-fetching on every search. Loaded once per tab mount.
  const regionsResult = await listRegions(db);
  const regionNameToId = new Map<string, string>(); // lowercase name or plate code → id
  if (regionsResult.ok && regionsResult.data) {
    for (const r of regionsResult.data) {
      regionNameToId.set(r.name.toLowerCase(), r.id);
      regionNameToId.set(r.plateCode, r.id);
    }
  }

  const config: ListViewConfig<Entry> = {
    columns: [
      { key: 'word', label: 'Kelime', render: e => e.word },
      { key: 'meaning', label: 'Anlam', render: e => e.meaning.slice(0, 80) },
      { key: 'region', label: 'İl', render: e => {
        const region = regionsResult.ok ? regionsResult.data?.find(r => r.id === e.regionId) : null;
        return region ? region.name : e.regionId;
      }},
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
      { key: 'q', label: 'Kelime / İl', type: 'text' },
    ],
    // Client-side text search across word, meaning, and region name/plate code.
    // pageSize=200 covers most admin datasets; pagination disabled during search.
    fetch: async (filterValues) => {
      const rawStatus = filterValues.status;
      const status: 'active' | 'removed' | undefined =
        !rawStatus || rawStatus === 'all' ? undefined : (rawStatus as 'active' | 'removed');
      const r = await listEntries(db, status ? { status } : {}, 200);
      if (!r.ok) return { ok: false, error: r.error };
      if (!r.data) return { ok: false, error: { code: 'admin/no-data', message: 'Veri yok.' } };
      let items = r.data.items;
      const q = filterValues.q?.trim().toLowerCase();
      if (q) {
        const matchedRegionIds = new Set<string>();
        for (const [nameOrCode, id] of regionNameToId) {
          if (nameOrCode.includes(q)) matchedRegionIds.add(id);
        }
        items = items.filter((e) =>
          e.word.toLowerCase().includes(q) ||
          e.meaning.toLowerCase().includes(q) ||
          matchedRegionIds.has(e.regionId)
        );
        return { ok: true, data: { items, hasMore: false } };
      }
      return { ok: true, data: { items, hasMore: r.data.hasMore, lastVisible: r.data.lastVisible } };
    },
    emptyMessage: 'Hiç entry yok.',
  };
  await renderListView(container, config);
}