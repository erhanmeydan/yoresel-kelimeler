# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir. Format [Keep a Changelog](https://keepachangelog.com/) standardına dayanır.

## [Unreleased]

## [0.4.0] - 2026-07-02

### Added
- 🗺️ Interactive map — 81 il markers, region detail panel (Leaflet + Carto Voyager)
- 🔍 Full-text search — Turkish-aware, prefix matching
- ✍️ Entry creation (email/password + Google OAuth)
- 📝 Entry edit/delete for owners
- 💬 Comment system (read-only for anonymous, write for authenticated)
- ❤️ Like button (one-tap +1, no unlike)
- 👤 Profile page (own entries + own comments, edit/delete actions)
- 🏷️ Slug URLs + clean URL routing (`/entry/{slug}`, history API)
- 🔐 Google OAuth sign-in (popup + iOS Safari redirect fallback)
- 🌐 Custom domain support (voicescript.io via Firebase Authorized Domains)
- 📱 Responsive design (mobile-first)
- ♿ Reduced motion, keyboard navigation, semantic HTML, ARIA labels
- 🎨 Footer (editorial, brand-aligned)
- 🖼️ Favicon (Playfair Display "Y" wordmark)
- 🏆 Top Regions Leaderboard (scheduled + realtime `regionStats`)
- 🛡️ Moderation backend (Cloud Functions: moderateComment, blockUser, unblockUser, getAdminStats)
- 🤖 AI destekli geliştirme workflow'u (README + CONTRIBUTING)

### Technical
- Single-source searchTokens helper (`src/utils/searchTokens.ts`)
- Hardened Firestore rules:
  - Comments read public, create authenticated, delete own
  - Entries: owner edit, moderator override
  - Like increment by signed-in users (single-field controlled)
  - `blockedUsers/{uid}` blocks entry create
  - `auditLog/{id}` server-only write
- Composite indexes for entry queries (regionId+status+createdAt, status+searchTokens+createdAt, etc.)
- SPA navigation (history API + global click handler)
- TDD: searchTokens + slug unit tests
- Backfill scripts: searchTokens (100 entries), slugs (101 entries)
- `updateWeeklyStats` scheduled Cloud Function (her gece 03:00 Istanbul)
- `onEntryCreate` realtime regionStats increment
- GitHub Actions CI: hosting preview + live deploy
- **CI: functions auto-deploy on main push** (#32)

### Fixed
- Search not finding entries (empty searchTokens array)
- Map not stretching to viewport
- Modal clipping on short viewports
- Profile page padding missing
- Profile dropdown staying open
- Search result padding cramped
- All `#/...` hash links → clean URL migration
- Permission-denied error on slug query (rules required `status` filter)
- iOS Safari Google sign-in redirect + local persistence
- Firebase Admin SDK manual initialize (scheduled function crash fix)

### Housekeeping
- **Audit:** Progress bar animates `transform: scaleX()` (compositor thread, no layout thrash)
- **Audit:** Map container shows `:focus-visible` ring (keyboard a11y)
- **Polish:** Top-region bars grow-in animation via `@keyframes barFillIn`
- **UI:** Hero stats right-aligned (`justify-content: flex-end`); "Kapsam 7" stat removed

## [0.1.0] - 2026-06-28

### Added
- 🎉 Initial MVP
- 81 il region data (GeoJSON import)
- ~80 seed entries (kelime/deyim/atasözü)
- Email/password authentication
- Cloud Functions: `onEntryCreate` (searchTokens generator)
- Map with marker click → panel update
- Search bar with debounced query
- Basic Firestore security rules
- Firebase Hosting deployment
- SEO meta tags + OG image
- Mobile-responsive hero + map layout

### Technical
- Vite 5 + TypeScript 5 strict
- Leaflet 1.9 + OpenStreetMap
- Firebase Hosting + Firestore + Auth + Functions
- Playfair Display + IBM Plex Sans typography
- OKLCH color tokens
- Restrained primary (moss green) + accent (warm ochre)
- Modular service layer
- Editorial design language (no AI-slop patterns)