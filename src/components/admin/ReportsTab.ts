import { db } from '../../config/firebase';
import { listOpenReports } from '../../services/reports.service';
import { removeEntryRemote } from '../../services/moderation.service';
import { getProfile } from '../../services/auth.service';
import { confirmAction } from './shared/ConfirmDialog';
import type { UserProfile } from '../../types/models';

export async function renderReportsTab(target: HTMLElement): Promise<void> {
  target.innerHTML = '';

  const result = await listOpenReports(db);
  if (!result.ok || result.data.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Açık rapor yok.';
    target.appendChild(empty);
    return;
  }

  for (const report of result.data) {
    const card = document.createElement('article');
    card.className = 'report-card';

    const p1 = document.createElement('p');
    const label1 = document.createElement('strong');
    label1.textContent = 'Kayıt: ';
    p1.append(label1, document.createTextNode(report.entryId));

    const p2 = document.createElement('p');
    const label2 = document.createElement('strong');
    label2.textContent = 'Sebep: ';
    p2.append(label2, document.createTextNode(report.reason));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger';
    removeBtn.textContent = 'Kaldır';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn-secondary';
    dismissBtn.textContent = 'Reddet';

    removeBtn.addEventListener('click', async () => {
      const ok = await confirmAction('Bu kaydı kaldırmak istediğinizden emin misiniz?');
      if (!ok) return;
      await removeEntryRemote(db, report.entryId, report.reason);
      card.remove();
    });

    dismissBtn.addEventListener('click', () => {
      card.remove();
      // TODO(v2): persist dismissal, decrement counter
    });

    card.append(p1, p2, removeBtn, dismissBtn);
    target.appendChild(card);
  }
}
