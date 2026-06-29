export function renderFooter(container: HTMLElement): void {
  container.innerHTML = `
    <footer class="site-footer" aria-label="Site alt bilgi">
      <div class="site-footer-inner">
        <div class="site-footer-brand">
          <span class="brand-mark">Yöresel</span>
          <p class="site-footer-tagline">
            Türkiye'nin 81 iline ait yöresel kelimeleri, deyimleri ve atasözlerini topluluk katkısıyla büyüten kültürel arşiv.
          </p>
        </div>

        <nav class="site-footer-nav" aria-label="Alt navigasyon">
          <div class="site-footer-col">
            <h4 class="site-footer-col-title">Keşfet</h4>
            <ul>
              <li><a href="/">Harita</a></li>
              <li><a href="/contribute">Katkıda Bulun</a></li>
            </ul>
          </div>
          <div class="site-footer-col">
            <h4 class="site-footer-col-title">Topluluk</h4>
            <ul>
              <li><a href="/profile">Profilim</a></li>
              <li><a href="https://github.com/erhanmeydan/yoresel-kelimeler" target="_blank" rel="noopener">Kaynak Kodu</a></li>
            </ul>
          </div>
          <div class="site-footer-col">
            <h4 class="site-footer-col-title">Yasal</h4>
            <ul>
              <li><a href="/privacy">Gizlilik</a></li>
              <li><a href="/terms">Kullanım Şartları</a></li>
            </ul>
          </div>
        </nav>
      </div>

      <div class="site-footer-bottom">
        <p>© ${new Date().getFullYear()} Yöresel · Topluluk katkısıyla büyüyen kültürel arşiv</p>
        <p class="site-footer-tech">Firebase · Vite · TypeScript · OpenStreetMap</p>
      </div>
    </footer>
  `;
}