/**
 * SPA navigation helper — clean URL + history API.
 * Tüm component'ler bu fonksiyonu kullanır, böylece router güncellemeleri tek noktada kalır.
 */
export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Path değiştirir ama history'ye yeni entry eklemez (replaceState).
 * Hash-based eski URL'leri clean URL'ye migrate ederken kullanılır.
 */
export function replacePath(path: string): void {
  window.history.replaceState({}, '', path);
}