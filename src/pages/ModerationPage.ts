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
    card.innerHTML = `
      <p><strong>Kayıt:</strong> ${report.entryId}</p>
      <p><strong>Sebep:</strong> ${report.reason}</p>
      <button class="btn-primary" data-action="remove">Kaldır</button>
      <button class="btn-secondary" data-action="dismiss">Reddet</button>
    `;
    card.querySelector<HTMLButtonElement>('[data-action=remove]')!.addEventListener('click', async () => {
      await removeEntryRemote(db, report.entryId, report.reason);
      card.remove();
    });
    target.appendChild(card);
  }
}