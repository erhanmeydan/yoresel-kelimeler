import { auth, db } from '../config/firebase';
import { createReport } from '../services/reports.service';
import { showAuthDrawer } from './AuthDrawer';

export function renderReportButton(container: HTMLElement, entryId: string): void {
  const button = document.createElement('button');
  button.className = 'btn-secondary report-btn';
  button.textContent = 'Bildir';

  button.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showAuthDrawer('login');
      return;
    }
    const reason = window.prompt('Bildirim nedeni:');
    if (!reason?.trim()) return;
    const result = await createReport(db, entryId, user.uid, reason.trim());
    if (result.ok) {
      window.alert('Bildiriminiz alındı. Teşekkürler.');
    } else {
      window.alert(result.error.message);
    }
  });

  container.appendChild(button);
}