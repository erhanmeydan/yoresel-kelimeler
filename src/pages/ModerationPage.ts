import { auth, db } from '../config/firebase';
import { listOpenReports } from '../services/reports.service';
import { removeEntryRemote } from '../services/moderation.service';
import { getProfile } from '../services/auth.service';
import type { Report, UserProfile } from '../types/models';

export async function renderModerationPage(container: HTMLElement): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    container.innerHTML = '<p>Yetkisiz. Giriş yapın.</p>';
    return;
  }

  const profileResult = await getProfile(db, user.uid);
  if (!profileResult.ok || !profileResult.data || !['moderator', 'admin'].includes(profileResult.data.role)) {
    container.innerHTML = '<p>Bu sayfaya erişim yetkiniz yok.</p>';
    return;
  }

  container.innerHTML = `
    <div class="page-container">
      <h2>Moderasyon Paneli</h2>
      <div id="reports-list"></div>
    </div>
  `;

  const listEl = container.querySelector<HTMLDivElement>('#reports-list')!;
  await loadReports(listEl, profileResult.data);
}

async function loadReports(target: HTMLElement, _profile: UserProfile): Promise<void> {
  const result = await listOpenReports(db);
  if (!result.ok || result.data.length === 0) {
    target.innerHTML = '<p>Açık rapor yok.</p>';
    return;
  }

  target.innerHTML = '';
  for (const report of result.data) {
    const card = document.createElement('article');
    card.className = 'report-card';

    // Safe DOM construction — no user data via innerHTML (XSS)
    const p1 = document.createElement('p');
    const label1 = document.createElement('strong');
    label1.textContent = 'Kayıt: ';
    p1.append(label1, document.createTextNode(report.entryId));

    const p2 = document.createElement('p');
    const label2 = document.createElement('strong');
    label2.textContent = 'Sebep: ';
    p2.append(label2, document.createTextNode(report.reason));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-primary';
    removeBtn.dataset.action = 'remove';
    removeBtn.textContent = 'Kaldır';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn-secondary';
    dismissBtn.dataset.action = 'dismiss';
    dismissBtn.textContent = 'Reddet';

    card.append(p1, p2, removeBtn, dismissBtn);

    removeBtn.addEventListener('click', async () => {
      await removeEntryRemote(db, report.entryId, report.reason);
      card.remove();
    });

    target.appendChild(card);
  }
}