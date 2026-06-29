# Yöresel Kelimeler Haritası

> Türkiye'nin 81 iline ait yöresel kelime, deyim ve atasözlerini harita üzerinde topluluk katkısıyla büyüyen kültürel arşiv.

[![Live Demo](https://yoresel-kelimeler.web.app)](https://yoresel-kelimeler.web.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting-orange)](https://firebase.google.com/)

---

## 🌐 Canlı demo

**[yoresel-kelimeler.web.app](https://yoresel-kelimeler.web.app)** — Vite + TypeScript SPA, Firebase Hosting üzerinde. Custom domain: **[voicescript.io](https://voicescript.io)**

## ✨ Özellikler

- 🗺️ **İnteraktif harita** — 81 il marker'ı, tıklanabilir region detayı (Leaflet + Carto Voyager)
- 🔍 **Çok token arama** — Türkçe karakter desteği, prefix match, 100+ entry içinde anlık
- ✍️ **Topluluk katkısı** — Entry ekleme (auth + email/Google OAuth), düzenleme, silme
- 💬 **Yorumlar** — "Bu aslında Kayseri'nin değil Bayburt'undur" gibi düzeltmeler için yorum sistemi
- ❤️ **Beğeni** — tek tıkla like (Firestore rule ile korumalı)
- 👤 **Profil sayfası** — kendi entry'lerini ve yorumlarını yönetme
- 🏷️ **Slug URL'ler** — SEO-friendly clean URL (`/entry/kusleme-izgara-et-yemegi`)
- 🎨 **Editorial tasarım** — Playfair Display + IBM Plex Sans, OKLCH renk paleti, restrained primary
- 🌙 **Reduced motion** desteği, klavye navigasyonu, semantic HTML

## 🛠️ Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Build | Vite 5 + TypeScript 5 (strict, exactOptionalPropertyTypes) |
| UI | Vanilla TS + CSS — sıfır framework, sıfır UI kütüphanesi |
| Harita | Leaflet + OpenStreetMap (Carto Voyager tiles) |
| Backend | Firebase Hosting + Firestore + Auth (Spark plan) |
| Functions | Firebase Cloud Functions v2 (onEntryCreate: searchTokens) |
| Tipografi | Playfair Display (serif) + IBM Plex Sans (sans) |
| Test | Vitest (unit) + Firebase Rules Unit Testing |

## 🚀 Hızlı başlangıç

### Önkoşullar

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Bir Firebase projesi (ücretsiz Spark plan yeterli)

### 1. Repo'yu klonla

```bash
git clone https://github.com/voicescript-io/yoresel-kelimeler.git
cd yoresel-kelimeler
npm install
```

### 2. Firebase projesi oluştur

1. [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. **Firestore Database** oluştur (production mode)
3. **Authentication** → Sign-in method → **Email/Password** ve **Google** enable
4. **Project Settings** → General → **Web app** ekle → config'i kopyala

### 3. Environment variables

`.env.example` dosyasını `.env.local` olarak kopyala ve doldur:

```bash
cp .env.example .env.local
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 4. Service account (admin scripts için)

Firebase Console → Project Settings → Service Accounts → **Generate new private key**.

JSON içeriğini `.env.local`'e ekle:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Veya dosya olarak kaydet (`service-account.json` zaten `.gitignore`'da).

### 5. Firestore rules + indexes deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 6. Geliştirme

```bash
# Emulator'ler (Auth + Firestore + Hosting)
firebase emulators:start

# Vite dev server (ayrı terminal)
npm run dev
```

Uygulama: [http://localhost:5173](http://localhost:5173)

## 🌱 Seed verileri

```bash
npm run seed:regions   # 81 il (GeoJSON)
npm run seed:entries   # ~80 örnek kelime/deyim
```

## 📦 Scripts

| Komut | Açıklama |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (`dist/`) |
| `npm run typecheck` | TypeScript strict kontrol |
| `npm run seed:regions` | 81 il seed |
| `npm run seed:entries` | Örnek entry'ler |
| `npm run deploy` | Tüm Firebase deploy |
| `firebase deploy --only hosting` | Sadece frontend |
| `firebase deploy --only firestore:rules` | Sadece rules |

## 🏗️ Mimari

```
src/
├── main.ts                # Router (history API), SPA navigation
├── pages/                 # Route-level component'ler
│   ├── HomePage.ts        # Harita + Son Eklenenler
│   ├── EntryDetailPage.ts # Tek entry görünümü (like + comments)
│   ├── ContributePage.ts  # Entry ekle/düzenle
│   ├── ProfilePage.ts     # Kullanıcı paneli
│   └── ModerationPage.ts  # Moderatör paneli
├── components/            # Yeniden kullanılabilir UI
│   ├── Header.ts, Footer.ts
│   ├── EntryCard.ts, SearchBar.ts
│   ├── AuthDrawer.ts, EntryForm.ts
│   └── MapView.ts, ReportButton.ts
├── services/              # Firestore data layer
│   ├── auth.service.ts
│   ├── entries.service.ts
│   ├── regions.service.ts
│   ├── comments.service.ts
│   ├── reports.service.ts
│   └── moderation.service.ts
├── utils/                 # Pure helpers
│   ├── slug.ts           # Türkçe → ASCII slug
│   ├── searchTokens.ts   # Search token generator
│   ├── navigate.ts       # SPA navigation
│   ├── validation.ts, sanitize.ts, geo.ts
├── config/                # Firebase init + constants
└── styles/                # Design tokens + components

functions/src/             # Cloud Functions
├── onEntryCreate.ts       # searchTokens generate
└── adminActions.ts        # Moderator action'ları
```

### Routing

Clean URL + history API (hash-based değil):

```
/                          # Ana sayfa (harita + son eklenenler)
/entry/{slug}             # Entry detayı
/contribute               # Yeni entry
/contribute?edit={id}     # Entry düzenle
/profile                  # Kullanıcı paneli
/moderation               # Moderatör paneli (mod only)
```

Eski `#/entry/{id}` URL'leri otomatik `/entry/{slug}` adresine migrate edilir (backward compat).

### Search mimarisi

`src/utils/searchTokens.ts` — tek doğru kaynak:

```ts
computeSearchTokens(word, meaning, example)
// → Türkçe lower-case + noktalama temizle + her kelime + 2-4 prefix
```

Hem backfill script hem Cloud Function (`onEntryCreate`) bunu kullanır. Yeni entry'ler otomatik search tokens ile gelir.

## 🤝 Katkıda bulunma

[CONTRIBUTING.md](CONTRIBUTING.md) rehberine bak. PR'lar `develop` branch'ine açılır.

### Branch stratejisi

- `main` — production (Firebase Hosting canlı)
- `develop` — aktif geliştirme
- `feature/*` — yeni özellik
- `fix/*` — bug düzeltme

### Conventional commits

```
feat: yeni özellik
fix: bug düzeltme
chore: refactor / docs / config
```

## 🐛 Issue / PR

- **Bug report**: [bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md)
- **Feature request**: [feature_request.md](.github/ISSUE_TEMPLATE/feature_request.md)

## 📜 Lisans

[MIT](LICENSE) — Serbestçe kullan, değiştir, dağıt.

Seed veriler **TDK Yöresel Ağız Sözlüğü** ve kültürel kaynaklardan derlenmiştir.

## 🙏 Teşekkürler

- [Firebase](https://firebase.google.com/) — hosting + firestore + auth
- [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/) contributors — harita altyapısı
- [Vite](https://vitejs.dev/) — build tool
- [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) + [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) — tipografi
- TDK Yöresel Ağız Sözlüğü — referans kaynak

---

**Sıcak · Köklü · Erişilebilir** — Türkiye'nin kültürel arşivi, topluluk katkısıyla.