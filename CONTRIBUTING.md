# Katkıda bulunma

**Yöresel Kelimeler**'e katkıda bulunmak istediğin için teşekkürler! 🇹🇷

Topluluk katkısıyla büyüyen kültürel bir arşiviz — her türlü katkı değerlidir.

## 🚀 Hızlı başlangıç

1. **Repo'yu fork'la** (GitHub'da sağ üstteki Fork butonu)
2. **Feature branch aç**: `git checkout -b feature/yeni-sozcuk`
3. **Değişiklik yap**, commit'le, push'la
4. **PR aç** → `develop` branch'ine

## 🛠️ Geliştirme ortamı

### Önkoşullar

- Node.js 20+
- npm 10+
- Firebase CLI: `npm install -g firebase-tools`
- Bir Firebase projesi (Spark plan yeterli, ücretsiz)

### Setup

```bash
git clone https://github.com/{username}/yoresel-kelimeler.git
cd yoresel-kelimeler
npm install
cp .env.example .env.local  # Firebase config'i doldur
firebase deploy --only firestore:rules,firestore:indexes
npm run dev
```

### Scripts

```bash
npm run dev           # Vite dev server (port 5173)
npm run typecheck     # TypeScript strict kontrol
npm run build         # Production build
npm run seed:regions  # 81 il seed
npm run seed:entries  # Örnek entry seed
```

### Emulator'ler

```bash
firebase emulators:start
# Auth:        http://localhost:9099
# Firestore:   http://localhost:8080
# Hosting:     http://localhost:5000
```

`.env.local`'e `VITE_USE_EMULATORS=true` ekleyince Vite dev server emulator'leri kullanır.

## 🌿 Branch stratejisi

- **`main`** — production (Firebase Hosting canlı). Sadece release PR'ları.
- **`develop`** — aktif geliştirme. Feature PR'ları buraya.
- **`feature/*`** — yeni özellik
- **`fix/*`** — bug düzeltme
- **`chore/*`** — refactor / docs / config

```bash
git checkout develop
git pull origin develop
git checkout -b feature/yeni-sozcuk-ekleme
```

## 📝 Conventional commits

Commit mesajları [Conventional Commits](https://www.conventionalcommits.org/) formatında:

```
feat: yorum sistemi eklendi
fix: search results köşelere yapışıktı
chore: README güncellendi
docs: CONTRIBUTING rehberi eklendi
refactor: searchTokens helper'ı çıkarıldı
test: slug unit testleri eklendi
```

PR açarken **scope** belirtin:

```
feat(comments): yorum silme eklendi
fix(search): padding düzeltildi
```

## ✅ PR checklist

PR açmadan önce:

- [ ] `npm run typecheck` temiz geçiyor
- [ ] `npm run build` başarılı
- [ ] Yeni feature için **unit test** eklendi (TDD)
- [ ] `git status` ile yanlışlıkla `service-account.json` veya `.env.local` eklenmediğini kontrol ettim
- [ ] `git diff --staged` ile değişiklikleri gözden geçirdim
- [ ] Commit mesajı conventional format'ta

## 🔒 Güvenlik

**Asla** commit'leme:

- `service-account.json`
- `.env.local` veya herhangi `.env.*` dosyası
- API keys, OAuth secrets

Eğer yanlışlıkla commit'lendiysen **hemen** rotate et (Firebase Console → Service Accounts → regenerate key).

`.gitignore` zaten bu dosyaları ignore ediyor. Yine de `git status` ile kontrol et.

## 🎨 Tasarım prensipleri

- **Editorial tipografi** — serif başlık + sans body
- **Restrained color** — primary küçük doz, accent warm ochre
- **AI-slop'tan kaçın** — gradient text, side-stripe border, eyebrow, numbered sections YAPMA
- **OKLCH** renk sistemi
- **Semantic HTML** — article, header, nav, footer
- **A11y** — klavye navigasyonu, focus görünür, ARIA labels, reduced motion

## 🐛 Bug raporu

[Issue templates](.github/ISSUE_TEMPLATE/) kullan. Şunları içer:

- Hatayı reproduce etme adımları
- Beklenen davranış
- Gerçek davranış
- Tarayıcı / OS / cihaz
- Console log (varsa, kişisel bilgi olmadan)

## 💡 Özellik önerisi

Issue template'inde "feature request" seç. Açık ve spesifik ol:

- **Problem** — hangi sorunu çözüyor?
- **Önerilen çözüm** — nasıl görünmeli?
- **Alternatifler** — başka yaklaşımlar düşündün mü?

## 📞 İletişim

- **Issues**: [GitHub Issues](https://github.com/erhanmeydan/yoresel-kelimeler/issues)
- **Discussions**: GitHub Discussions (henüz yok, ileride açılabilir)

## 🙏 Code of Conduct

Bu proje [Contributor Covenant](CODE_OF_CONDUCT.md) ile yönetilir. Katılarak kurallara uymayı kabul edersin.

---

**Sorular?** Issue aç veya mevcut issue'lara yorum yap.