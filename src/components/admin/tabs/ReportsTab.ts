import { auth, db } from '../../../config/firebase';
import { renderListView, type ListViewConfig } from '../shared/ListView';
import { confirm } from '../shared/ConfirmDialog';
import { listReports, resolveReport, dismissReport } from '../../../services/admin/reports.service';
import type { Report } from '../../../types/models';

export async function renderReportsTab(container: HTMLElement): Promise<void> {
  const config: ListViewConfig<Report> = {
    columns: [
      { key: 'entry', label: 'İçerik', render: r => r.entryId },
      { key: 'reason', label: 'Sebep', render: r => r.reason },
      { key: 'reporter', label: 'Bildiren', render: r => r.reporterId },
      { key: 'date', label: 'Tarih', render: r => new Date(r.createdAt.toMillis()).toLocaleDateString('tr-TR') },
      { key: 'status', label: 'Durum', render: r => r.status === 'open' ? 'Açık' : r.status === 'resolved' ? 'Çözüldü' : 'Reddedildi' },
    ],
    actions: [
      {
        label: 'Çöz', variant: 'primary',
        isVisible: r => r.status === 'open',
        onClick: async (r) => {
          if (!await confirm({ title: 'Raporu çöz?', message: r.reason })) return;
          const res = await resolveReport(db, r.id!, auth.currentUser!.uid);
          if (res.ok) await renderReportsTab(container);
        },
      },
      {
        label: 'Reddet', variant: 'secondary',
        isVisible: r => r.status === 'open',
        onClick: async (r) => {
          if (!await confirm({ title: 'Raporu reddet?', message: r.reason })) return;
          const res = await dismissReport(db, r.id!, auth.currentUser!.uid);
          if (res.ok) await renderReportsTab(container);
        },
      },
    ],
    filters: [
      {
        key: 'status', label: 'Durum', type: 'select',
        options: [
          { value: 'open', label: 'Açık' },
          { value: 'resolved', label: 'Çözüldü' },
          { value: 'dismissed', label: 'Reddedildi' },
        ],
      },
    ],
    fetch: async (filterValues) => {
      const rawStatus = filterValues.status;
      const status: 'open' | 'resolved' | 'dismissed' | undefined =
        !rawStatus ? undefined : (rawStatus as 'open' | 'resolved' | 'dismissed');
      const filters: { status?: 'open' | 'resolved' | 'dismissed' } = {};
      if (status) filters.status = status;
      const r = await listReports(db, filters);
      if (!r.ok) return { ok: false, error: r.error };
      if (!r.data) return { ok: false, error: { code: 'reports/no-data', message: 'Veri yok.' } };
      return { ok: true, data: r.data };
    },
    emptyMessage: 'Rapor yok.',
  };
  await renderListView(container, config);
}