# Admin Moderation Panel — Tasarım Spec

**Tarih:** 2026-07-01
**Durum:** Onaylandı (kullanıcı onayı alındı, 3 section tamam)
**Kapsam:** v1 — Yorum silme + Kullanıcı engelleme + Basit dashboard. v2 — Audit log + Bulk actions (bu spec dışı)
**Bağlı spec:** `2026-06-28-yoresel-kelimeler-design.md`

---

## 1. Amaç ve Bağlam

Mevcut `ModerationPage` sadece **Report'lara göre** entry kaldırma/dismiss akışı sağlıyor. Yeni ihtiyaçlar:
- Direkt yorum silme (report gerektirmeden)
- Kullanıcı yazma engeli (read-only mod)
- Hızlı istatistik dashboard (kaç rapor, kaç engellenen)

Üç özellik tek bir **Server-side callable Cloud Functions + Audit log + Counter** mimarisinde birleştirilir. v2'ye audit log ve bulk actions bırakılır.

### Hedef Kitle
- Moderator/admin rolüne sahip kullanıcılar (Erhan + gelecekte diğer güvenilir üyeler)

### Başarı Kriterleri
- Moderatör bir yorumu tek tıkla silebilmeli
- Moderatör bir kullanıcıyı tek tıkla engelleyebilmeli / açabilmeli
- Dashboard yüklendiğinde gerçek zamanlı counter'lar (cached)
- Tüm admin işlemleri server-side, audit log'a yazılır
- Mobile UI çalışır (kullanıcı site mobil erişim de yapar)

---

## 2. Kapsam Dışı (YAGNI)

v2'ye bırakılan:
- **Audit log UI görüntüleme** — yazılır ama UI'da gözükmez
- **Bulk actions** — çoklu seçim ve toplu silme
- **Restore** — silinen yorumu geri getirme (soft-delete yerine hard-delete)
- **Spam detection** — pattern-based auto-flagging
- **User-agent detail** — IP, browser fingerprints
- **Comment report queue** — v1'de reporter flow yok, admin direkt liste görür

---

## 3. Teknoloji Yığını (Mevcut)

| Katman | Tercih | Kullanım |
|--------|--------|----------|
| Backend | Firebase Functions v2 (Node 20) | 3 yeni callable + 1 existing extend |
| Veritabanı | Firestore | 3 yeni collection: `blockedUsers`, `auditLog`, `counters/adminStats` |
| Frontend | Vanilla TS + Vite 5.4 | Mevcut pattern, tab-based UI |
| Test | Vitest 2.1 + @firebase/rules-unit-testing 3.0 | Service unit tests |

---

## 4. Mimari

```
┌──────────────────────────────────────────────────────────────────┐
│  /moderation (existing route, extend)                            │
│  ┌──────────────┬──────────────┬─────────────┬──────────────┐     │
│  │ Raporlar     │ Yorumlar     │ Kullanıcılar│ İstatistik   │     │
│  │ (existing)   │  (NEW)       │  (NEW)      │  (NEW)       │     │
│  └──────┬───────┴──────┬───────┴──────┬──────┴─────┬────────┘     │
└─────────┼──────────────┼──────────────┼────────────┼──────────────┘
          │              │              │            │
          ▼              ▼              ▼            ▼
       moderateEntry  moderateComment blockUser   getAdminStats
       (existing)     (NEW)          unblockUser (NEW)
          │              │              │            │
          └──────────────┴──────────────┴────────────┘
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │  Firebase Admin SDK                       │
              │  - Firestore ops                         │
              │  - writeAuditLog (her action'da)         │
              │  - incrementCounter (counter doc)        │
              │  - assertIsAdmin (role check)            │
              └───────────────────────────────────────────┘
```

### 5 Ana Karar

1. **Server-side** (callable functions, admin SDK) — A yaklaşımı, güvenlik en yüksek
2. **Ayrı `blockedUsers` collection** — history tutulabilir, liste sorgusu kolay
3. **Counter'da `FieldValue.increment`** — atomik, race condition güvenli
4. **Audit log append-only** — sadece server-side write, modify edilemez
5. **Hard-delete yorumlar** — soft-delete v1 karmaşıklığı gereksiz (restore v2'de)

---

## 5. Veri Modeli

### Yeni Collection'lar

**`blockedUsers/{uid}`** — blocked user kayıtları

```typescript
interface BlockedUser {
  uid: string;
  blockedBy: string;        // admin uid
  blockedAt: Timestamp;
  reason?: string;          // opsiyonel açıklama
}
```

Rules: `allow read: if isModerator()` (admin görsün), `allow write: if false` (sadece admin SDK).

**`auditLog/{autoId}`** — append-only admin aksiyon logu

```typescript
interface AuditEntry {
  action: string;            // 'comment.delete', 'user.block', 'user.unblock'
  targetType: string;        // 'comment' | 'user' | 'entry'
  targetId: string;
  actorUid: string;          // admin who performed action
  actorName: string;         // for readability
  createdAt: Timestamp;
  metadata?: Record<string, unknown>;
}
```

Rules: `allow read: if isModerator()`, `allow write: if false`.

**`counters/adminStats`** — admin dashboard cache

```typescript
interface AdminStats {
  reportsOpen: number;          // open reports count
  commentsDeletedToday: number;  // reset at midnight UTC (cron)
  blockedUsersCount: number;    // current blocked users
  updatedAt: Timestamp;
}
```

Rules: `allow read: if isModerator()`, `allow write: if false`.

### Değişen Collection'lar

**`comments/{commentId}`** — Rule güncellendi: moderator de silebilir
```javascript
allow update, delete: if (isSignedIn() && resource.data.authorId == request.auth.uid)
                     || isModerator();
```

**`entries/{entryId}`** — Rule: blocked user yazamaz
```javascript
allow create: if isSignedIn()
               && exists(/databases/$(database)/documents/blockedUsers/$(request.auth.uid)) == false
               // ... mevcut rules
```

---

## 6. Backend Implementation

### Yeni Callable Functions (`functions/src/admin.ts`)

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { getProfile } from './helpers';

async function assertIsAdmin(req: any): Promise<{ uid: string; name: string }> {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Giriş yapmalısın.');
  const profile = await getProfile(getFirestore(), req.auth.uid);
  if (!profile || !['moderator', 'admin'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'Yönetici yetkisi gerekli.');
  }
  return { uid: req.auth.uid, name: profile.displayName };
}

async function writeAuditLog(entry: object): Promise<void> {
  await getFirestore().collection('auditLog').add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function incrementCounter(key: string, delta = 1): Promise<void> {
  await getFirestore().collection('counters').doc('adminStats')
    .set({ [key]: FieldValue.increment(delta) }, { merge: true });
}

// 1. moderateComment (action: 'delete')
export const moderateComment = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  const admin = await assertIsAdmin(req);
  const { commentId } = req.data;
  if (typeof commentId !== 'string') {
    throw new HttpsError('invalid-argument', 'commentId zorunlu.');
  }
  
  await getFirestore().collection('comments').doc(commentId).delete();
  await writeAuditLog({
    action: 'comment.delete',
    targetType: 'comment',
    targetId: commentId,
    actorUid: admin.uid,
    actorName: admin.name,
  });
  await incrementCounter('commentsDeletedToday');
  
  return { ok: true };
});

// 2. blockUser
export const blockUser = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  const admin = await assertIsAdmin(req);
  const { targetUid, reason } = req.data;
  if (typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'targetUid zorunlu.');
  }
  if (targetUid === admin.uid) {
    throw new HttpsError('failed-precondition', 'Kendini engelleyemezsin.');
  }
  
  await getFirestore().collection('blockedUsers').doc(targetUid).set({
    uid: targetUid,
    blockedBy: admin.uid,
    blockedAt: FieldValue.serverTimestamp(),
    reason: reason ?? null,
  }, { merge: false });
  
  await writeAuditLog({
    action: 'user.block',
    targetType: 'user',
    targetId: targetUid,
    actorUid: admin.uid,
    actorName: admin.name,
    metadata: { reason: reason ?? null },
  });
  await incrementCounter('blockedUsersCount', +1);
  
  return { ok: true };
});

// 3. unblockUser
export const unblockUser = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  const admin = await assertIsAdmin(req);
  const { targetUid } = req.data;
  if (typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'targetUid zorunlu.');
  }
  
  await getFirestore().collection('blockedUsers').doc(targetUid).delete();
  
  await writeAuditLog({
    action: 'user.unblock',
    targetType: 'user',
    targetId: targetUid,
    actorUid: admin.uid,
    actorName: admin.name,
  });
  await incrementCounter('blockedUsersCount', -1);
  
  return { ok: true };
});

// 4. getAdminStats (dashboard cache)
export const getAdminStats = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  await assertIsAdmin(req);
  const doc = await getFirestore().collection('counters').doc('adminStats').get();
  const data = doc.exists ? doc.data()! : {};
  return {
    reportsOpen: data.reportsOpen ?? 0,
    commentsDeletedToday: data.commentsDeletedToday ?? 0,
    blockedUsersCount: data.blockedUsersCount ?? 0,
  };
});
```

### New: `listAllComments`, `listBlockedUsers` reads (client-side)

```typescript
// src/services/commentsModeration.service.ts (YENİ)
import { collection, getDocs, query, orderBy, limit, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Comment } from '../types/models';

export async function listAllComments(
  db: Firestore, max = 50,
): Promise<ServiceResult<Comment[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.COMMENTS),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment) };
  } catch (err) {
    return { ok: false, error: { code: 'comments/admin-list-failed', message: 'Yorumlar yüklenemedi.' } };
  }
}

// src/services/adminUsers.service.ts (YENİ)
export async function listBlockedUsers(db: Firestore): Promise<ServiceResult<BlockedUser[]>> {
  // benzer pattern, blockedUsers koleksiyonundan
}
```

---

## 7. Frontend Implementation

### Yeni Component'ler

```
src/components/admin/
├── ReportsTab.ts       (extracted from ModerationPage, no logic change)
├── CommentsTab.ts      (NEW)
├── UsersTab.ts         (NEW)
├── StatsTab.ts         (NEW)
└── shared/
    ├── TabBar.ts       (extracted)
    └── ConfirmDialog.ts (reusable confirm() replacement)
```

### `CommentsTab.ts`

```typescript
import { db } from '../../config/firebase';
import { listAllComments } from '../../services/commentsModeration.service';
import { deleteComment } from '../../services/admin.service';
import type { Comment } from '../../types/models';

export async function renderCommentsTab(container: HTMLElement): Promise<void> {
  const result = await listAllComments(db, 50);
  if (!result.ok || result.data.length === 0) {
    container.innerHTML = '<p class="empty-state">Hiç yorum yok.</p>';
    return;
  }

  container.innerHTML = '';
  for (const c of result.data) {
    const card = createCommentCard(c);
    card.querySelector('.delete-btn')?.addEventListener('click', async () => {
      if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) return;
      const res = await deleteComment(c.id ?? '');
      if (res.ok) {
        card.remove();
      } else {
        alert(res.error.message);
      }
    });
    container.appendChild(card);
  }
}

function createCommentCard(c: Comment): HTMLElement {
  const card = document.createElement('article');
  card.className = 'comment-admin-card';

  // Safe DOM construction — no user data via innerHTML
  const authorEl = document.createElement('strong');
  authorEl.textContent = c.authorName;

  const textEl = document.createElement('p');
  textEl.textContent = c.text;

  const dateEl = document.createElement('time');
  dateEl.textContent = new Date(c.createdAt.toMillis()).toLocaleString('tr');

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger delete-btn';
  delBtn.textContent = 'Sil';
  delBtn.setAttribute('aria-label', `Yorumu sil: ${c.text.slice(0, 50)}`);

  card.append(authorEl, textEl, dateEl, delBtn);
  return card;
}
```

### `UsersTab.ts` (benzer pattern)

```typescript
export async function renderUsersTab(container: HTMLElement): Promise<void> {
  // ... benzer:
  // - listBlockedUsers(db)
  // - Her card: isim, blockedAt, reason, "Engeli Kaldır" button
  // - Click → unblockUser + card.remove()
}
```

### `StatsTab.ts`

```typescript
export async function renderStatsTab(container: HTMLElement): Promise<void> {
  container.innerHTML = '<div class="stats-grid">...</div>';
  const result = await getAdminStats();
  if (!result.ok) {
    container.innerHTML = '<p>Hata</p>';
    return;
  }
  // 3 widget renderle
  renderCounterWidget(container, 'Açık Raporlar', result.data.reportsOpen);
  renderCounterWidget(container, 'Bugün Silinen Yorum', result.data.commentsDeletedToday);
  renderCounterWidget(container, 'Engellenen Kullanıcı', result.data.blockedUsersCount);
}
```

### `ModerationPage.ts` (rewrite)

```typescript
export async function renderModerationPage(container: HTMLElement): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    container.innerHTML = '<p>Yetkisiz.</p>';
    return;
  }
  const profileResult = await getProfile(db, user.uid);
  if (!profileResult.ok || !['moderator', 'admin'].includes(profileResult.data?.role ?? '')) {
    container.innerHTML = '<p>Bu sayfaya erişim yetkiniz yok.</p>';
    return;
  }

  // ... render tab bar + content area
  // ... setupTabs(container.querySelector('.tab-bar')!)
  // ... default tab: 'reports' (existing logic extracted to ReportsTab)
}
```

### CSS (existing + ek)

```css
/* src/styles/pages/moderation.css (yeni veya home.css'e ekle) */

.tab-bar {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-divider);
  margin-bottom: var(--space-5);
}

.tab-btn {
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font: inherit;
  color: var(--color-muted);
}

.tab-btn.active {
  border-bottom-color: var(--color-primary);
  color: var(--color-text);
}

.comment-admin-card,
.user-admin-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.btn-danger {
  color: var(--color-danger);
  background: transparent;
  border: 1px solid var(--color-danger);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}
```

---

## 8. Error Handling & Edge Cases

| Senaryo | Handling |
|---------|----------|
| Function cold start timeout (60s) | UI loading spinner, retry button |
| Permission denied (non-admin) | "Bu sayfaya erişim yetkiniz yok" (existing) |
| Network failure | UI error: "Ağ hatası — tekrar deneyin" |
| Self-block attempt | Function rejects: "Kendini engelleyemezsin" |
| Counter drift | Cached, max 5 min — acceptable |
| Concurrent deletes | First wins, second gets not-found error |
| Concurrent block + entry create | Firestore rule check at write time = strict |

---

## 9. Performance

### Read cost

- `comments` list (admin): 50 doc × 200 byte = ~10KB, 1 read
- `blockedUsers` list: ~10-100 doc, 1 read
- `counters/adminStats`: 1 doc, cached

### Write cost

- 1 callable invocation per admin action
- Admin SDK writes are FREE (no charge for writes from privileged backend)

### Latency

- ~200-500ms (cold start to warm)
- ~100ms (warm)
- Acceptable for admin actions

---

## 10. Testing Stratejisi

### Unit Tests

```typescript
// tests/services/admin.service.test.ts (yeni)
describe('deleteComment', () => {
  it('calls moderateComment callable and returns ok');
  it('returns error on permission-denied');
});

describe('blockUser', () => {
  it('calls blockUser callable and returns ok');
  it('rejects self-block');
});

// tests/services/commentsModeration.test.ts
describe('listAllComments', () => {
  it('returns comments sorted by createdAt desc');
  it('handles empty collection');
});

// tests/services/adminUsers.test.ts
describe('listBlockedUsers', () => {
  it('returns blocked user list');
});

// tests/functions/admin.test.ts (functions/src/)
describe('moderateComment', () => {
  it('admin can delete comment');
  it('rejects non-admin with permission-denied');
  it('writes audit log entry');
  it('increments counter');
});

describe('blockUser', () => {
  it('admin can block');
  it('rejects self-block');
  it('writes audit log');
});
```

### Manuel Smoke Test (deployment sonrası)

1. /moderation'a git → 4 tab görünür
2. Reports tab → existing flows OK
3. Comments tab → 10 yorum listele, birini sil → audit log'a yazılsın
4. Users tab → kendi uid'ini block et → "Kendini engelleyemezsin" hatası
5. Farklı bir user'ı block et → listede görünsün, unblock yap
6. Stats tab → counters doğru
7. Blocklu user → /contribute → submit edemiyor (rule reject)

---

## 11. Migration & Deploy

### Sıralı Deploy

- **PR 1 (Backend):**
  - Firestore rules güncelle (comments moderator delete, entries blocked user check, blockedUsers read rules)
  - `functions/src/admin.ts` (4 callable) + `helpers.ts`
  - `functions/src/index.ts` export
  - Tests
  - Deploy: `firebase deploy --only functions,firestore:rules`

- **PR 2 (Frontend):**
  - Service'ler (`admin.service.ts`, `commentsModeration.service.ts`, `adminUsers.service.ts`)
  - Components (`CommentsTab.ts`, `UsersTab.ts`, `StatsTab.ts`, `ReportsTab.ts` extracted)
  - ModerationPage refactor
  - CSS
  - Tests
  - CI auto-deploy via existing workflow

PR'lar sıralı merge edilir (PR 1 önce).

---

## 12. Açık Sorular

- ❓ Tab routing: URL'de `?tab=users` gibi query params tutalım mı? (fresh navigation'da state restore)
- ❓ Counts: `commentsDeletedToday` reset'i — Cloud Scheduler ile her gece mi, basit atlanır mı? (v1: atlanır)
- ❓ Comment delete öncesi confirm() yerine custom dialog? (v1: browser confirm yeterli)

---

## 13. Definition of Done

- [ ] 3 callable functions deploy edildi (moderateComment, blockUser, unblockUser)
- [ ] getAdminStats callable deploy edildi
- [ ] Firestore rules updated: comments + entries + blockedUsers
- [ ] `admin.service.ts` (client wrappers) deployed
- [ ] 4 tab UI çalışıyor (Raporlar, Yorumlar, Kullanıcılar, İstatistikler)
- [ ] Audit log her action'da write ediyor (verified via log inspect)
- [ ] Counter'lar doğru artıyor (verified via log inspect)
- [ ] Blocklu user entry giremez (rule test)
- [ ] Admin yetkisi olmayan UI'ı açamıyor (role check)
- [ ] Mobile responsive (tested)
- [ ] All tabs kullanılabilir (aria-label, keyboard nav)
- [ ] Definition of Done: 12/12 ✅

---

## 14. v2'ye Ertelenenler

- Audit log UI görüntüleme
- Bulk actions (toplu seçim/silme)
- Comment soft-delete (restore)
- Auto-moderation (keyword filtering)
- IP/user-agent logging
- Spam detection (rate limit per user)

---

**Onaylayan:** Erhan Meydan
**Tarih:** 2026-07-01
**Sonraki adım:** Implementation plan (writing-plans skill)
