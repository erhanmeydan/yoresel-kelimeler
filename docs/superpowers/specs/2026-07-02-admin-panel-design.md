# Admin Moderation Panel v2 — Tasarım Spec

**Tarih:** 2026-07-02
**Durum:** Onaylandı (brainstorming session tamamlandı)
**Önceki spec:** `2026-07-01-admin-moderation-panel-design.md` (superseded — soft delete + Entries tab eklendi)
**Kapsam:** v2 — Yorum + Entry soft-delete (restore v1'de), Kullanıcı engelleme, Reports queue, Stats dashboard
**Bağlı spec:** `2026-06-28-yoresel-kelimeler-design.md`

---

## 1. Amaç ve Bağlam

Moderatörlerin tek bir panelden yorum, entry ve kullanıcı üzerinde işlem yapabilmesini sağlamak. v1 spec'i hard-delete yaklaşımını kullanıyordu; bu revizyon:

1. **Soft delete** ekler — moderator hatalarını geri alma şansı
2. **Entries tab** ekler — mevcut `entries` koleksiyonu için admin UI
3. **Generic ListView** ile kod tekrarını önler

Backend altyapısı (4 callable + helpers + audit log + counter) **zaten merge edildi** (PR #33). Bu spec sadece UI tarafını ele alır.

### Hedef Kitle

`role: 'moderator'` veya `role: 'admin'` olan kullanıcılar.

### Başarı Kriterleri

- Moderatör yorumu tek tıkla **soft-delete** yapabilir, **geri al**abilir
- Moderatör entry'yi soft-delete yapabilir, geri alabilir
- Kullanıcıyı engelleyebilir / engeli kaldırabilir
- Reports queue (kullanıcıların bildirdiği içerik) görüntülenebilir ve çözülebilir
- Dashboard gerçek zamanlı istatistikleri gösterir
- Tüm admin işlemleri server-side callable üzerinden, audit log'a yazılır
- Mobile UI çalışır (admin tablet/cep'ten de girebilmeli)

---

## 2. Kapsam Dışı (YAGNI)

- Bulk actions (çoklu seçim + toplu silme) — v3
- Audit log UI (zaten yazılıyor ama gösterilmiyor) — v3
- User role değiştirme UI (sadece moderator'ü admin yapma yok) — v3
- Spam detection / auto-flagging — v3
- IP / user-agent logging — v3
- Real-time dashboard (websocket update) — v3
- Grafik / chart (haftalık aktivite trendi) — v3

---

## 3. Mimari Genel Bakış

```
┌──────────────────────────────────────────────────────────────────┐
│  /moderation (existing route)                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Moderasyon Paneli                                          │  │
│  │ [Raporlar] [Yorumlar] [Maddeler] [Kullanıcılar] [İstatistik]│  │
│  │ ═══════════════════════════════════════════════════════════ │  │
│  │                                                            │  │
│  │ ┌─ ListView (generic, DRY) ─────────────────────────────┐ │  │
│  │ │ [Filter bar: search, status select, region select]    │ │  │
│  │ │ ─────────────────────────────────────────────────────│ │  │
│  │ │ # | İçerik | Yazar | Tarih | Status  | Aksiyon       │ │  │
│  │ │ 1 | ...    | Ahmet  | 2 gün | active  | [Sil] [Geri Al]│ │  │
│  │ │ 2 | ...    | Ayşe   | 1 hft | removed | [Geri Al]     │ │  │
│  │ │ ─────────────────────────────────────────────────────│ │  │
│  │ │ ‹ 1 2 3 4 5 › (pagination)                          │ │  │
│  │ └────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         │              │              │             │
         ▼              ▼              ▼             ▼
   moderateComment  moderateEntry  blockUser    getAdminStats
   (existing)      (existing)    unblockUser  (existing)
         │              │              │
         └──────┬───────┴──────┬───────┘
                ▼              ▼
        writeAuditLog   incrementCounter
        (her action'da)  (adminStats doc)
```

### Karar

| Karar | Tercih | Gerekçe |
|-------|--------|---------|
| Mimari | **Tab-based** | Mevcut pattern, mobile-friendly, hızlı geliştirme |
| Liste component | **Generic ListView** | 5 tab × ayrı component = kod tekrarı, DRY ihlali |
| Delete davranışı | **Soft delete** | Restore mümkün, audit trail korunur |
| Onay mekanizması | **Modal dialog** (ConfirmDialog) | Browser `confirm()` kötü UX |
| Pagination | **Server-side cursor** | 100'lerce entry, scroll değil |
| Filter | **Server-side** (Firestore `where` clause) | Tüm veriyi client'e çekme |
| Cache invalidation | **Per-action refetch** | Soft delete sonrası liste güncellenir |

---

## 4. Veri Modeli

Mevcut yapı değişmiyor. Backend zaten merge edildi (PR #33). Önemli alanlar:

### Entries (soft delete alanları)
```typescript
interface Entry {
  // ... existing fields
  status: 'active' | 'removed';
  removedReason?: string;     // PR #15'te eklendi
  removedBy?: string;        // admin uid
  removedAt?: Timestamp;
}
```

### Comments (soft delete alanları)
```typescript
interface Comment {
  // ... existing fields
  // status alanı yok şu an — soft delete için eklenmeli
}
```

> **Not:** Comments'ta `status` alanı yok. Soft delete için ya `status: 'active' | 'removed'` eklemeli ya da hard delete kullanmalı. PR #15'in rules'ı sadece `exists(/blockedUsers/...)` kontrol ediyor. **Bu spec soft delete için comments'a `status` alanı eklenmesini öneriyor.**

### Reports (queue)
```typescript
interface Report {
  entryId: string;
  reporterId: string;
  reason: string;          // ≤ 200 char
  status: 'open' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  createdAt: Timestamp;
}
```

### Counters (adminStats doc)
```typescript
interface AdminStats {
  reportsOpen: number;
  commentsDeletedToday: number;  // günlük reset (v3'te cron)
  blockedUsersCount: number;
  updatedAt: Timestamp;
}
```

---

## 5. Backend (Mevcut — Değişiklik Yok)

PR #33 ile merge edildi. Callable'lar:

| Function | Purpose | Auth |
|----------|---------|------|
| `moderateComment` | Yorum sil (soft delete v2'de) | moderator/admin |
| `moderateEntry` | Entry sil (soft delete) | moderator/admin |
| `blockUser` | Kullanıcı engelle | moderator/admin |
| `unblockUser` | Engeli kaldır | moderator/admin |
| `getAdminStats` | Dashboard sayaçları | moderator/admin |

**Eksik (v2'de eklenmeli):**
- `restoreComment` — soft delete'i geri al
- `restoreEntry` — soft delete'i geri al

**PR #15 rules zaten:**
- `entries/{id}.status = 'removed'` public'ten filtrelenir
- `comments/{id}.update hasOnly(['text'])` — author güncelleme sınırı

**v2 için eklenmeli:**
- `comments/{id}` artık `status` alanı taşıyacak, rules `update hasOnly(['text', 'status'])` olmalı (sadece server-side status update mümkün — Cloud Function üzerinden)

---

## 6. Frontend Mimari

### Dosya Yapısı

```
src/pages/ModerationPage.ts                      # revize (5 tab)
src/components/admin/
├── shared/
│   ├── TabBar.ts                                # mevcut (küçük iyileştirme)
│   ├── ListView.ts                              # YENİ — generic
│   ├── ConfirmDialog.ts                         # YENİ
│   ├── EmptyState.ts                            # YENİ (basit)
│   ├── FilterBar.ts                             # YENİ
│   └── Pagination.ts                            # YENİ
├── tabs/
│   ├── ReportsTab.ts                            # mevcut, ListView'a migrate
│   ├── CommentsTab.ts                           # mevcut, ListView'a migrate + restore
│   ├── EntriesTab.ts                            # YENİ
│   ├── UsersTab.ts                              # mevcut, ListView'a migrate
│   └── StatsTab.ts                              # mevcut, küçük iyileştirme
src/services/admin/
├── admin.service.ts                             # mevcut (deleteComment, callable wrappers)
├── adminUsers.service.ts                        # mevcut, restore eklenecek
├── commentsModeration.service.ts                # mevcut, restore eklenecek
├── entriesModeration.service.ts                 # YENİ (list, softDelete, restore)
├── reports.service.ts                           # YENİ (list, resolve, dismiss)
src/styles/pages/moderation.css                  # mevcut, güncelle
```

### Generic ListView Component

5 tab'ı ayrı ayrı yazmak yerine, generic ListView:

```typescript
// src/components/admin/shared/ListView.ts
interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => HTMLElement | string;
  width?: string; // CSS grid template
}

interface Action<T> {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: (item: T) => void | Promise<void>;
  isVisible?: (item: T) => boolean;
}

interface Filter {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: Array<{ value: string; label: string }>;
}

interface ListViewConfig<T> {
  columns: Array<Column<T>>;
  actions: Array<Action<T>>;
  filters: Filter[];
  fetch: (filterValues: Record<string, string>) => Promise<ServiceResult<{
    items: T[];
    hasMore: boolean;
    lastVisible?: unknown;
  }>>;
  emptyMessage: string;
  pageSize?: number; // default 25
}

export async function renderListView<T extends { id: string }>(
  container: HTMLElement,
  config: ListViewConfig<T>,
): Promise<void> {
  // 1. Render filter bar
  // 2. Render table
  // 3. Wire up filter changes → re-fetch
  // 4. Wire up action buttons → call onClick
  // 5. Wire up pagination → cursor-based
}
```

**5 tab için config örnekleri (kısaltılmış):**

```typescript
// CommentsTab.ts
const config: ListViewConfig<Comment> = {
  columns: [
    { key: 'author', label: 'Yazar', render: c => c.authorName },
    { key: 'text', label: 'Yorum', render: c => c.text.slice(0, 100) },
    { key: 'date', label: 'Tarih', render: c => formatDate(c.createdAt) },
    { key: 'status', label: 'Durum', render: c => statusBadge(c.status) },
  ],
  actions: [
    {
      label: 'Sil',
      variant: 'danger',
      isVisible: c => c.status === 'active',
      onClick: c => softDeleteComment(c.id),
    },
    {
      label: 'Geri Al',
      variant: 'secondary',
      isVisible: c => c.status === 'removed',
      onClick: c => restoreComment(c.id),
    },
  ],
  filters: [
    { key: 'status', label: 'Durum', type: 'select',
      options: [{value: 'all', label: 'Hepsi'}, {value: 'active', label: 'Aktif'}, {value: 'removed', label: 'Silinmiş'}] },
    { key: 'q', label: 'Ara', type: 'text' },
  ],
  fetch: async (filters) => listComments(filters),
  emptyMessage: 'Yorum yok.',
};
```

### ConfirmDialog

Browser `confirm()` yerine styled modal:

```typescript
// src/components/admin/shared/ConfirmDialog.ts
export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;     // default 'Onayla'
  cancelLabel?: string;      // default 'İptal'
  variant?: 'danger' | 'warning';
}

export function confirm(options: ConfirmDialogOptions): Promise<boolean> {
  // Render modal, return Promise<boolean> based on user choice
}
```

### Soft Delete UX Pattern

Her soft-deleteable entity için:
- **[Sil]** butonu → ConfirmDialog → onay → `status: 'removed'` set et → refetch
- **[Geri Al]** butonu (sadece removed durumda görünür) → `status: 'active'` set et → refetch

### State Restoration (URL query)

```typescript
// URL: /moderation?tab=entries&status=removed&q=ahmet
// Browser back/forward çalışır, refresh state korur
function getTabFromUrl(): AdminTab {
  const params = new URLSearchParams(window.location.search);
  return (params.get('tab') as AdminTab) ?? 'reports';
}

function setTabInUrl(tab: AdminTab): void {
  const params = new URLSearchParams(window.location.search);
  params.set('tab', tab);
  window.history.replaceState({}, '', `?${params.toString()}`);
}
```

---

## 7. Error Handling

| Senaryo | Handling |
|---------|----------|
| Function timeout (>30s) | "İşlem zaman aşımına uğradı" toast, retry butonu |
| Permission denied | "Bu işlem için yetkiniz yok" (auth.role check) |
| Network failure | "Ağ hatası" inline error, retry |
| Optimistic update mismatch | Refetch list, restore correct state |
| Self-block attempt | Frontend filter (hide button) + backend reject (defense-in-depth) |
| Concurrent edits | Last write wins, refetch on action completion |

---

## 8. Performance

### Read cost
- 5 tab için toplam ~5 collection okuması (lazy — sadece aktif tab fetch)
- Soft-delete filter: `where('status', '==', 'removed')` (composite index gerekebilir)

### Write cost
- 1 callable invocation per admin action
- Admin SDK writes = ücretsiz

### Latency
- Callable warm: ~100-200ms
- List fetch (50 items): ~200-400ms
- Pagination cursor: ~100ms

### Optimistic UI
- Soft delete → optimistic DOM removal → background server call → on failure, restore + toast

---

## 9. Testing Stratejisi (TDD)

### Component Tests (vitest + jsdom)

```typescript
// tests/components/admin/shared/ListView.test.ts
describe('ListView', () => {
  it('renders columns from config')
  it('renders filter bar from config')
  it('calls fetch with filter values on filter change')
  it('renders empty state when no items')
  it('calls action onClick when action button clicked')
  it('handles pagination next/prev')
})

// tests/components/admin/shared/ConfirmDialog.test.ts
describe('ConfirmDialog', () => {
  it('resolves true on confirm')
  it('resolves false on cancel')
  it('closes on Escape key')
  it('traps focus within dialog')
})

// tests/components/admin/tabs/CommentsTab.test.ts
describe('CommentsTab', () => {
  it('renders comment list')
  it('shows Sil button for active comments')
  it('shows Geri Al for removed comments')
  it('opens ConfirmDialog on Sil click')
  it('calls deleteComment service on confirm')
})
```

### Service Tests

```typescript
// tests/services/admin/entriesModeration.service.test.ts
describe('entriesModeration.service', () => {
  it('listEntries respects status filter')
  it('listEntries respects search query')
  it('softDeleteEntry calls moderateEntry callable with action=remove')
  it('restoreEntry calls moderateEntry callable with action=restore')
})
```

### E2E (manuel smoke test)

Deployment sonrası:
1. `/moderation` → 5 tab görünür
2. Comments tab → bir yorumu soft-delete → liste anında güncellenir → [Geri Al] görünür
3. Entries tab → bir entry'yi soft-delete → harita/aramalardan kaybolur
4. Users tab → bir kullanıcıyı block et → listede görünür, unblock
5. Reports tab → bir raporu çöz → counter azalır
6. Stats tab → counter'lar doğru

---

## 10. Migration & Deploy

### Sıralı PR'lar

**PR 1 — Backend soft delete (comments):**
- Comment schema'ya `status` field ekle (default 'active')
- Firestore rules: `comments/{id}.update hasOnly(['text', 'status'])` 
- Cloud Functions: `restoreComment`, `restoreEntry` callables
- Tests
- Deploy: `firebase deploy --only functions,firestore:rules`

**PR 2 — Frontend generic ListView:**
- `shared/ListView.ts`, `ConfirmDialog.ts`, `FilterBar.ts`, `Pagination.ts`
- Unit tests
- Deploy: GitHub Actions (PR preview first)

**PR 3 — Tab migration:**
- 5 tab'ı ListView'a migrate et
- Comments/Entries restore UX
- New entriesModeration.service.ts
- Migration of existing 4 tabs
- Integration tests

**PR 4 — URL state + polish:**
- Tab URL param persistence
- Mobile responsive
- Final QA

PR'lar sıralı merge edilir, her biri kendi PR preview'ında test edilir.

---

## 11. Açık Sorular

- ❓ Comments soft delete → status field eklemek gerek. Migration: mevcut comment'lere default 'active' yazmak için script mi?
- ❓ Pagination cursor'ı — `lastVisible` snapshot'ı client'te mi tutalım yoksa URL'e mi koyalım?
- ❓ `confirm()` browser dialog'u bazı browser'larda blocked oluyor (iframe sandbox). Custom modal gerekli mi?
- ❓ Reports resolve/dismiss için UI — modal mı inline dropdown mı?

Bunlar implementation sırasında kararlaştırılacak.

---

## 12. Definition of Done

- [ ] Comments soft delete (status='removed') + restore callable
- [ ] Entries soft delete (status='removed' zaten var) + restore callable
- [ ] Generic ListView component + 4 unit test'i
- [ ] ConfirmDialog component + 4 unit test'i
- [ ] CommentsTab, EntriesTab, UsersTab, ReportsTab, StatsTab tümü ListView kullanıyor
- [ ] URL state restoration (`?tab=...&status=...&q=...`)
- [ ] Mobile responsive (tested on < 768px)
- [ ] Soft-delete UX (Sil / Geri Al butonları + confirm dialog)
- [ ] Tab indicator + keyboard navigation
- [ ] Audit log her action'da yazılıyor (verified)
- [ ] Counter'lar doğru artıyor (verified)
- [ ] Engellenen kullanıcı entry giremez (rule test)
- [ ] Admin yetkisi olmayan UI'ı açamıyor (role check)
- [ ] Definition of Done: 13/13 ✅

---

## 13. v3'e Ertelenenler

- Bulk actions (toplu seçim + toplu silme)
- Audit log UI (görüntüleme + filtreleme)
- User role değiştirme UI
- Real-time dashboard (websocket)
- Spam detection / auto-moderation
- IP / user-agent logging
- Charts / trend visualization

---

**Onaylayan:** Erhan Meydan (brainstorming session, 2026-07-02)
**Önceki spec:** `2026-07-01-admin-moderation-panel-design.md` (superseded)
**Sonraki adım:** Implementation plan (writing-plans skill)