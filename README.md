# Yöresel Kelimeler Haritası

Türkiye'nin 81 iline ait yöresel kelime, deyim ve atasözlerini harita üzerinde topluluk katkısıyla büyüyen kültürel arşiv.

## Kurulum

1. Bağımlılıklar: `npm install`
2. Firebase projesi oluştur, web app config'i `.env.local`'e ekle
3. Service account JSON'u indir, `.env.local`'e `FIREBASE_SERVICE_ACCOUNT_JSON` olarak ekle
4. Emulator'leri başlat: `firebase emulators:start`
5. Geliştirme: `npm run dev`

## Seed

- `npm run seed:regions` — 81 il
- `npm run seed:entries` — ~80 örnek kelime/deyim

## Deploy

- `firebase deploy` — hosting + firestore rules + functions

## Mimari

Detaylar için `docs/superpowers/specs/2026-06-28-yoresel-kelimeler-design.md`.

## Lisans

MIT. Seed veriler TDK Yöresel Ağız Sözlüğü ve kültürel kaynaklardan derlenmiştir.