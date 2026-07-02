export type AdminTab = 'reports' | 'comments' | 'entries' | 'users' | 'stats';

export function renderTabBar(
  container: HTMLElement,
  active: AdminTab,
  onChange: (tab: AdminTab) => void,
): void {
  container.innerHTML = '';
  container.className = 'tab-bar';
  container.setAttribute('role', 'tablist');

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'reports', label: 'Raporlar' },
    { id: 'comments', label: 'Yorumlar' },
    { id: 'entries', label: 'Maddeler' },
    { id: 'users', label: 'Kullanıcılar' },
    { id: 'stats', label: 'İstatistikler' },
  ];

  for (const t of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.role = 'tab';
    btn.className = 'tab-btn' + (t.id === active ? ' active' : '');
    btn.dataset.tab = t.id;
    btn.setAttribute('aria-selected', String(t.id === active));
    btn.setAttribute('aria-controls', 'tab-content');
    btn.textContent = t.label;
    btn.addEventListener('click', () => onChange(t.id));
    container.appendChild(btn);
  }
}