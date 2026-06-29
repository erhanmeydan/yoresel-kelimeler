# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir. Format [Keep a Changelog](https://keepachangelog.com/) standardına dayanır.

## [Unreleased]

### Added
- 🗺️ Interactive map — 81 il markers, region detail panel (Leaflet + Carto Voyager)
- 🔍 Full-text search — Turkish-aware, prefix matching
- ✍️ Entry creation (email/password + Google OAuth)
- 📝 Entry edit/delete for owners
- 💬 Comment system (read-only for anonymous, write for authenticated)
- ❤️ Like button (one-tap +1, no unlike)
- 👤 Profile page (own entries + own comments, edit/delete actions)
- 🏷️ Slug URLs + clean URL routing (`/entry/{slug}`, history API)
- 🔐 Google OAuth sign-in
- 🌐 Custom domain support (voicescript.io via Firebase Authorized Domains)
- 📱 Responsive design (mobile-first)
- ♿ Reduced motion, keyboard navigation, semantic HTML, ARIA labels
- 🎨 Footer (editorial, brand-aligned)
- 🖼️ Favicon (Playfair Display "Y" wordmark)

### Technical
- Single-source searchTokens helper (`src/utils/searchTokens.ts`)
- Hardened Firestore rules:
  - Comments read public, create authenticated, delete own
  - Entries: owner edit, moderator override
  - Like increment by signed-in users (single-field controlled)
- Composite indexes for entry queries (regionId+status+createdAt, status+searchTokens+createdAt, etc.)
- SPA navigation (history API + global click handler)
- TDD: searchTokens helper with 11 unit tests
- Backfill scripts: searchTokens (100 entries), slugs (101 entries)

### Fixed
- Search not finding entries (empty searchTokens array)
- Map not stretching to viewport
- Modal clipping on short viewports
- Profile page padding missing
- Profile dropdown staying open
- Search result padding cramped
- All `#/...` hash links → clean URL migration
- Permission-denied error on slug query (rules required `status` filter)

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