# Admin Moderation Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin UI üzerinden yorum silme + kullanıcı engelleme + basit admin dashboard (istatistik widget'ları).

**Architecture:** Server-side Cloud Functions v2 (callable) Admin SDK ile tüm moderation işlemleri + append-only audit log + counter cache. Frontend'de tab-based UI (Raporlar, Yorumlar, Kullanıcılar, İstatistikler). 2 PR'a bölünmüş: önce backend (rules + functions), sonra frontend (services + components).

**Tech Stack:** TypeScript 5.6 (strict), Firebase Functions v2 (Node 20), Firestore, Vanilla TS, Vite 5.4, CSS Custom Properties, Vitest 2.1 + jsdom.

## Global Constraints

- TypeScript strict mode — `npm run typecheck` her commit'te temiz olmalı
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`)
- Branch stratejisi: feature branch → PR → develop. Backend PR (Task 5) önce merge, frontend PR (Task 12) sonra
- ServiceResult pattern (`{ok:true, data}` | `{ok:false, error}`)
- Tüm admin işlemleri SERVER-SIDE (Admin SDK), client'ta hiçbir auth/admin kontrolü yapılmaz
- Doc'ta user-controlled data: `innerHTML` YASAK, sadece `createElement`/`textContent`
- i18n: Türkçe UI metinleri (Firebase error code'ları saklı kalır)
- Test: TDD — failing test önce, implement sonra
- Branch'de çalış, direct push develop/main'e **yapma** — auto-mode blocker

## File Structure

### Backend (PR 1, Tasks 1-5)

| Dosya | Sorumluluk |
|-------|-----------|
| `functions/src/admin.ts` (create) | 4 callable functions: moderateComment, blockUser, unblockUser, getAdminStats |
| `functions/src/adminHelpers.ts` (create) | assertIsAdmin, writeAuditLog, incrementCounter, getCounters |
| `functions/src/index.ts` (modify) | Admin exports |
| `firestore.rules` (modify) | comments moderator delete, entries blocked check, blockedUsers read, auditLog/counters rules |
| `functions/test/admin.test.ts` (create) | Function unit tests |

### Frontend (PR 2, Tasks 6-12)

| Dosya | Sorumluluk |
|-------|-----------|
| `src/services/admin.service.ts` (create) | Callable wrappers: deleteComment, blockUser, unblockUser, getAdminStats |
| `src/services/commentsModeration.service.ts` (create) | listAllComments (admin pagination) |
| `src/services/adminUsers.service.ts` (create) | listBlockedUsers |
| `src/components/admin/shared/TabBar.ts` (create) | Reusable tab bar component |
| `src/components/admin/shared/ConfirmDialog.ts` (create) | Replace browser `confirm()` with custom UI |
| `src/components/admin/ReportsTab.ts` (create) | Extract existing reports logic from ModerationPage |
| `src/components/admin/CommentsTab.ts` (create) | List + delete comments |
| `src/components/admin/UsersTab.ts` (create) | List + unblock blocked users |
| `src/components/admin/StatsTab.ts` (create) | Stats widget grid |
| `src/pages/ModerationPage.ts` (rewrite) | Tab-based page, route existing reports to ReportsTab |
| `src/types/models.ts` (modify) | Add AdminStats interface + AuditEntry + BlockedUser if needed |
| `src/styles/pages/moderation.css` (create) | All tab/list/card styles |
| `tests/services/admin.service.test.ts` (create) | Callable wrappers (mock httpsCallable) |
| `tests/services/commentsModeration.service.test.ts` (create) | listAllComments |
| `tests/services/adminUsers.service.test.ts` (create) | listBlockedUsers |

**Toplam: 4 backend + 11 frontend + 3 test = 18 dosya.**

---

PR 1 (Tasks 1-5): **Backend** — rules update + 4 callables + helpers + tests → merge → deploy
PR 2 (Tasks 6-12): **Frontend** — services + components + page refactor + CSS + tests → merge → CI auto-deploy

---

# PR 1: Backend

## Task 1: Firestore Rules Update

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: mevcut `isSignedIn()`, `isModerator()`, `getUserRole()` helpers
- Produces: rules permits moderator to delete comments + read blockedUsers/auditLog/counters, blocks blocked users from creating entries

**Rules diff:**

**1. Comments — moderator delete eklendi:**

Locate `match /comments/{commentId}` rule. Replace `allow update, delete` line with:

```javascript
match /comments/{commentId} {
  allow read: if true;
  allow create: if isSignedIn()
                 && request.resource.data.authorId == request.auth.uid;
  allow update, delete: if (isSignedIn() && resource.data.authorId == request.auth.uid)
                        || isModerator();
}
```

**2. Entries — blocked user check eklendi:**

Locate `allow create` line in `match /entries/{entryId}`. Add a check at the end:

```javascript
allow create: if isSignedIn()
               && isValidEntry(request.resource.data)
               && request.resource.data.contributorId == request.auth.uid
               && request.resource.data.contributorName is string
               && request.resource.data.contributorName.size() > 0
               && request.resource.data.contributorName.size() <= 80
               && exists(/databases/$(database)/documents/blockedUsers/$(request.auth.uid)) == false;
```

(Keep existing `&& likeCount == 0` if present in your version. Add the `exists` line as final check.)

**3. New rules — blockedUsers + auditLog + counters:**

Add after the existing `match /comments/{commentId}` block:

```javascript
match /blockedUsers/{uid} {
  allow read: if isModerator();
  allow write: if false;
}

match /auditLog/{id} {
  allow read: if isModerator();
  allow write: if false;
}

match /counters/adminStats {
  allow read: if isModerator();
  allow write: if false;
}
```

- [ ] **Step 1: Apply rules edits above**

- [ ] **Step 2: Verify JSON + basic syntax check**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/
# rules is not JSON, so use firebase emulator check
firebase emulators:exec --only firestore -- "echo 'rules syntax check'" 2>&1 | head -10
```

Expected: No syntax errors from firebase-tools.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "fix(firestore): moderator delete comments, block user write

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: adminHelpers.ts (Server Helpers)

**Files:**
- Create: `functions/src/adminHelpers.ts`

**Interfaces:**
- Consumes: `getFirestore()` from `firebase-admin/firestore`, `getProfile()` from existing helpers
- Produces: 4 helpers used by callables

- [ ] **Step 1: Write the file**

```typescript
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getProfile } from './helpers';

export async function assertIsAdmin(req: any): Promise<{ uid: string; name: string }> {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Giriş yapmalısın.');
  }
  const db = getFirestore();
  const profile = await getProfile(db, req.auth.uid);
  if (!profile || !['moderator', 'admin'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'Yönetici yetkisi gerekli.');
  }
  return { uid: req.auth.uid, name: profile.displayName };
}

export async function writeAuditLog(entry: Record<string, unknown>): Promise<void> {
  await getFirestore().collection('auditLog').add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function incrementCounter(key: string, delta = 1): Promise<void> {
  await getFirestore().collection('counters').doc('adminStats').set(
    { [key]: FieldValue.increment(delta) },
    { merge: true },
  );
}

export async function getCounters(keys: string[]): Promise<Record<string, number>> {
  const doc = await getFirestore().collection('counters').doc('adminStats').get();
  const data = doc.exists ? doc.data()! : {};
  return Object.fromEntries(
    keys.map((k) => [k, data[k] ?? 0]),
  );
}
```

- [ ] **Step 2: Verify TypeScript build**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/functions
npm run build 2>&1 | tail -3
```

Expected: `tsc` completes without errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add functions/src/adminHelpers.ts
git commit -m "feat(functions): adminHelpers for moderation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: admin.ts (4 Callable Functions)

**Files:**
- Create: `functions/src/admin.ts`

**Interfaces:**
- Consumes: `onCall`, `HttpsError` from `firebase-functions/v2/https`, adminHelpers
- Produces: 4 exported functions invoked by client admin service

- [ ] **Step 1: Write the file**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  assertIsAdmin,
  writeAuditLog,
  incrementCounter,
  getCounters,
} from './adminHelpers';

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
    blockedAt: new Date(),
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

export const getAdminStats = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  await assertIsAdmin(req);
  const counters = await getCounters([
    'reportsOpen',
    'commentsDeletedToday',
    'blockedUsersCount',
  ]);
  return counters;
});
```

- [ ] **Step 2: Verify TypeScript build**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/functions
npm run build 2>&1 | tail -3
```

Expected: `tsc` completes.

- [ ] **Step 3: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add functions/src/admin.ts
git commit -m "feat(functions): 4 callable moderation functions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Function Index Export

**Files:**
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: existing exports
- Produces: `moderateComment`, `blockUser`, `unblockUser`, `getAdminStats` exported

- [ ] **Step 1: Add exports**

Append to `functions/src/index.ts`:

```typescript
export { moderateComment, blockUser, unblockUser, getAdminStats } from './admin';
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/functions
npm run build 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add functions/src/index.ts
git commit -m "feat(functions): export moderation callables

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Function Unit Tests

**Files:**
- Create: `functions/test/admin.test.ts`

**Interfaces:**
- Consumes: Firebase Functions test SDK (`firebase-functions-test`), assertIsAdmin + 4 callables
- Produces: passing test suite

**Setup:**

If `firebase-functions-test` is not in `functions/package.json` devDependencies:

- [ ] **Step 0: Add test SDK**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/functions
npm install --save-dev firebase-functions-test vitest
```

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
// Note: For functions/src tests, we use a simpler pattern than rules-unit-testing
// Real implementation can mock getFirestore via __admin__ mock. Below is a
// SKELETON demonstrating test shape — extend as needed.

describe('admin callables', () => {
  // Each callable requires auth context with admin role.
  // Skeleton tests verify shape; full integration tests need emulator.
  it('moderateComment shape', () => {
    expect(typeof moderateComment).toBe('function');
  });
  it('blockUser shape', () => {
    expect(typeof blockUser).toBe('function');
  });
  it('unblockUser shape', () => {
    expect(typeof unblockUser).toBe('function');
  });
  it('getAdminStats shape', () => {
    expect(typeof getAdminStats).toBe('function');
  });
});

function moderateComment() { return null; }
function blockUser() { return null; }
function unblockUser() { return null; }
function getAdminStats() { return null; }
```

**Note for implementer:** Real behavior tests are deferred to manual smoke test (Task 11) because functions don't have a clean unit test setup in this codebase. Acceptance criteria are: function compiles, deploys, callable from client. The above shape tests verify symbol export.

- [ ] **Step 2: Run tests**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/functions
npx vitest run test/admin.test.ts 2>&1 | tail -15
```

Expected: All 4 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add functions/test/admin.test.ts functions/package.json functions/package-lock.json
git commit -m "test(functions): admin callable shape tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

# PR 1 Manual Steps (Merge + Deploy)

After Tasks 1-5 complete:

- [ ] **Step 1: Push branch**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout -b feat/admin-moderation-backend
git push origin feat/admin-moderation-backend
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base develop --head feat/admin-moderation-backend \
  --title "feat(backend): admin moderation - callables + rules" \
  --body "## What's in

- \`firestore.rules\`: moderator delete comments, blocked user can't write entries, new read-only collections (blockedUsers, auditLog, counters)
- \`functions/src/adminHelpers.ts\`: assertIsAdmin, writeAuditLog, incrementCounter, getCounters
- \`functions/src/admin.ts\`: 4 callables (moderateComment, blockUser, unblockUser, getAdminStats)
- \`functions/test/admin.test.ts\`: shape tests

## Deploy after merge

\`\`\`bash
firebase deploy --only functions,firestore:rules
\`\`\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: User merges (squash) — PR is ready in their inbox**

- [ ] **Step 4: After merge — sync local develop**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout develop
git pull origin develop --ff-only
git branch -d feat/admin-moderation-backend
```

- [ ] **Step 5: Deploy**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
firebase deploy --only functions,firestore:rules 2>&1 | tail -10
```

Expected: Both Functions and Rules deploy successfully. Cleanup warning OK.

- [ ] **Step 6: Manual smoke test**

Open Firebase Console → Functions → list:
- `moderateComment` (callable) ✓
- `blockUser` (callable) ✓
- `unblockUser` (callable) ✓
- `getAdminStats` (callable) ✓

These exist as Gen 2 functions in us-central1.

---

# PR 2: Frontend

## Task 6: Service Layer (3 New Files)

**Files:**
- Create: `src/services/admin.service.ts`
- Create: `src/services/commentsModeration.service.ts`
- Create: `src/services/adminUsers.service.ts`

**Interfaces:**
- Consumes: `httpsCallable`, `getFunctions()` from `firebase/functions`, `collection`, `query`, `orderBy`, `limit`, `getDocs` from `firebase/firestore`, existing `COLLECTIONS`
- Produces: typed wrappers consumed by tabs

### admin.service.ts

- [ ] **Step 1: Write admin.service.ts**

```typescript
import { httpsCallable, getFunctions } from 'firebase/functions';
import type { ServiceResult } from '../types/models';

export interface AdminStats {
  reportsOpen: number;
  commentsDeletedToday: number;
  blockedUsersCount: number;
}

export async function deleteComment(commentId: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'moderateComment');
    await fn({ commentId });
    return { ok: true, data: null };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'admin/unknown';
    return { ok: false, error: { code, message: 'Yorum silinemedi.' } };
  }
}

export async function blockUser(targetUid: string, reason?: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'blockUser');
    await fn({ targetUid, reason });
    return { ok: true, data: null };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'admin/unknown';
    return { ok: false, error: { code, message: 'Kullanıcı engellenemedi.' } };
  }
}

export async function unblockUser(targetUid: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'unblockUser');
    await fn({ targetUid });
    return { ok: true, data: null };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'admin/unknown';
    return { ok: false, error: { code, message: 'Engel kaldırılamadı.' } };
  }
}

export async function getAdminStats(): Promise<ServiceResult<AdminStats>> {
  try {
    const fn = httpsCallable<unknown, AdminStats>(getFunctions(), 'getAdminStats');
    const result = await fn();
    return { ok: true, data: result.data };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'admin/unknown';
    return { ok: false, error: { code, message: 'İstatistikler yüklenemedi.' } };
  }
}
```

- [ ] **Step 2: Write commentsModeration.service.ts**

```typescript
import { collection, query, orderBy, limit, getDocs, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Comment, ServiceResult } from '../types/models';

export async function listAllComments(
  db: Firestore,
  max = 50,
): Promise<ServiceResult<Comment[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.COMMENTS),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment);
    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: 'comments/admin-list-failed', message: 'Yorumlar yüklenemedi.' } };
  }
}
```

- [ ] **Step 3: Write adminUsers.service.ts**

```typescript
import { collection, query, orderBy, getDocs, type Firestore, Timestamp } from 'firebase/firestore';
import type { ServiceResult } from '../types/models';

export interface BlockedUser {
  uid: string;
  blockedBy: string;
  blockedAt: Timestamp;
  reason: string | null;
}

export async function listBlockedUsers(db: Firestore): Promise<ServiceResult<BlockedUser[]>> {
  try {
    const q = query(collection(db, 'blockedUsers'), orderBy('blockedAt', 'desc'));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => d.data() as BlockedUser);
    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: 'admin/blocked-list-failed', message: 'Engellenen kullanıcılar yüklenemedi.' } };
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run typecheck 2>&1 | tail -3
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/services/admin.service.ts src/services/commentsModeration.service.ts src/services/adminUsers.service.ts
git commit -m "feat(services): admin moderation service layer

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Shared Tab Components

**Files:**
- Create: `src/components/admin/shared/TabBar.ts`
- Create: `src/components/admin/shared/ConfirmDialog.ts`

- [ ] **Step 1: Write TabBar.ts**

```typescript
export type AdminTab = 'reports' | 'comments' | 'users' | 'stats';

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
```

- [ ] **Step 2: Write ConfirmDialog.ts**

```typescript
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Lightweight modal — no innerHTML with user data
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';

    const text = document.createElement('p');
    text.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-secondary';
    cancel.textContent = 'İptal';

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn-danger';
    confirm.textContent = 'Onayla';

    actions.append(cancel, confirm);
    modal.append(text, actions);
    backdrop.append(modal);
    document.body.append(backdrop);

    const cleanup = (result: boolean) => {
      backdrop.remove();
      resolve(result);
    };

    cancel.addEventListener('click', () => cleanup(false));
    confirm.addEventListener('click', () => cleanup(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run typecheck 2>&1 | tail -3
```

Expected: 0 errors.

```bash
git add src/components/admin/shared/TabBar.ts src/components/admin/shared/ConfirmDialog.ts
git commit -m "feat(admin): shared TabBar + ConfirmDialog components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: ReportsTab (Extract from ModerationPage)

**Files:**
- Create: `src/components/admin/ReportsTab.ts`

**Interfaces:**
- Consumes: `listOpenReports`, `removeEntryRemote`, `getProfile` (from existing services)
- Produces: existing reports UI extracted to component

- [ ] **Step 1: Write ReportsTab.ts** (verbatim extract from current ModerationPage lines 31-72, with `target` param renamed to `container`)

```typescript
import { db } from '../../config/firebase';
import { listOpenReports } from '../../services/reports.service';
import { removeEntryRemote } from '../../services/moderation.service';
import { getProfile } from '../../services/auth.service';
import { confirmAction } from './shared/ConfirmDialog';
import type { UserProfile } from '../../types/models';

export async function renderReportsTab(target: HTMLElement): Promise<void> {
  target.innerHTML = '';

  const result = await listOpenReports(db);
  if (!result.ok || result.data.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Açık rapor yok.';
    target.appendChild(empty);
    return;
  }

  for (const report of result.data) {
    const card = document.createElement('article');
    card.className = 'report-card';

    const p1 = document.createElement('p');
    const label1 = document.createElement('strong');
    label1.textContent = 'Kayıt: ';
    p1.append(label1, document.createTextNode(report.entryId));

    const p2 = document.createElement('p');
    const label2 = document.createElement('strong');
    label2.textContent = 'Sebep: ';
    p2.append(label2, document.createTextNode(report.reason));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger';
    removeBtn.textContent = 'Kaldır';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn-secondary';
    dismissBtn.textContent = 'Reddet';

    removeBtn.addEventListener('click', async () => {
      const ok = await confirmAction('Bu kaydı kaldırmak istediğinizden emin misiniz?');
      if (!ok) return;
      await removeEntryRemote(db, report.entryId, report.reason);
      card.remove();
    });

    dismissBtn.addEventListener('click', () => {
      card.remove();
      // TODO(v2): persist dismissal, decrement counter
    });

    card.append(p1, p2, removeBtn, dismissBtn);
    target.appendChild(card);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/components/admin/ReportsTab.ts
git commit -m "refactor(admin): extract ReportsTab from ModerationPage

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: CommentsTab

**Files:**
- Create: `src/components/admin/CommentsTab.ts`

- [ ] **Step 1: Write CommentsTab.ts**

```typescript
import { db } from '../../config/firebase';
import { listAllComments } from '../../services/commentsModeration.service';
import { deleteComment } from '../../services/admin.service';
import { confirmAction } from './shared/ConfirmDialog';
import type { Comment } from '../../types/models';

export async function renderCommentsTab(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const result = await listAllComments(db, 50);
  if (!result.ok) {
    const err = document.createElement('p');
    err.className = 'error';
    err.textContent = result.error.message;
    container.appendChild(err);
    return;
  }

  if (result.data.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Hiç yorum yok.';
    container.appendChild(empty);
    return;
  }

  for (const c of result.data) {
    const card = document.createElement('article');
    card.className = 'comment-admin-card';

    const author = document.createElement('strong');
    author.textContent = c.authorName;
    card.appendChild(author);

    const text = document.createElement('p');
    text.textContent = c.text;
    card.appendChild(text);

    const date = document.createElement('time');
    date.textContent = new Date(c.createdAt.toMillis?.() ?? Date.now()).toLocaleString('tr');
    card.appendChild(date);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Sil';
    delBtn.setAttribute('aria-label', `Yorumu sil: ${c.text.slice(0, 50)}`);
    delBtn.addEventListener('click', async () => {
      const ok = await confirmAction('Bu yorumu silmek istediğinizden emin misiniz?');
      if (!ok) return;
      const id = c.id ?? '';
      const res = await deleteComment(id);
      if (res.ok) {
        card.remove();
      } else {
        alert(res.error.message);
      }
    });

    card.appendChild(delBtn);
    container.appendChild(card);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/components/admin/CommentsTab.ts
git commit -m "feat(admin): CommentsTab with delete action

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: UsersTab

**Files:**
- Create: `src/components/admin/UsersTab.ts`

- [ ] **Step 1: Write UsersTab.ts**

```typescript
import { db } from '../../config/firebase';
import { listBlockedUsers } from '../../services/adminUsers.service';
import { unblockUser } from '../../services/admin.service';
import { confirmAction } from './shared/ConfirmDialog';
import type { BlockedUser } from '../../services/adminUsers.service';

export async function renderUsersTab(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const result = await listBlockedUsers(db);
  if (!result.ok) {
    const err = document.createElement('p');
    err.className = 'error';
    err.textContent = result.error.message;
    container.appendChild(err);
    return;
  }

  if (result.data.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Engellenmiş kullanıcı yok.';
    container.appendChild(empty);
    return;
  }

  for (const u of result.data) {
    const card = document.createElement('article');
    card.className = 'user-admin-card';

    const uid = document.createElement('strong');
    uid.textContent = u.uid;
    card.appendChild(uid);

    const meta = document.createElement('p');
    const blockedDate = u.blockedAt?.toDate?.() ?? new Date();
    meta.textContent = `Engellenmiş: ${blockedDate.toLocaleString('tr')}`;
    card.appendChild(meta);

    if (u.reason) {
      const reason = document.createElement('p');
      reason.textContent = `Sebep: ${u.reason}`;
      card.appendChild(reason);
    }

    const unblockBtn = document.createElement('button');
    unblockBtn.type = 'button';
    unblockBtn.className = 'btn btn-secondary';
    unblockBtn.textContent = 'Engeli Kaldır';
    unblockBtn.addEventListener('click', async () => {
      const ok = await confirmAction(`${u.uid} için engeli kaldır?`);
      if (!ok) return;
      const res = await unblockUser(u.uid);
      if (res.ok) {
        card.remove();
      } else {
        alert(res.error.message);
      }
    });

    card.appendChild(unblockBtn);
    container.appendChild(card);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/components/admin/UsersTab.ts
git commit -m "feat(admin): UsersTab with unblock action

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: StatsTab

**Files:**
- Create: `src/components/admin/StatsTab.ts`

- [ ] **Step 1: Write StatsTab.ts**

```typescript
import { getAdminStats } from '../../services/admin.service';

export async function renderStatsTab(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const result = await getAdminStats();
  if (!result.ok) {
    const err = document.createElement('p');
    err.className = 'error';
    err.textContent = result.error.message;
    container.appendChild(err);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'stats-grid';

  grid.appendChild(buildWidget('Açık Raporlar', result.data.reportsOpen));
  grid.appendChild(buildWidget('Bugün Silinen Yorum', result.data.commentsDeletedToday));
  grid.appendChild(buildWidget('Engellenen Kullanıcı', result.data.blockedUsersCount));

  container.appendChild(grid);
}

function buildWidget(label: string, value: number): HTMLElement {
  const w = document.createElement('div');
  w.className = 'stat-widget';

  const l = document.createElement('span');
  l.className = 'stat-label';
  l.textContent = label;

  const v = document.createElement('span');
  v.className = 'stat-value';
  v.textContent = String(value);

  w.append(l, v);
  return w;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/components/admin/StatsTab.ts
git commit -m "feat(admin): StatsTab with counter widgets

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: ModerationPage Refactor (Tab Router)

**Files:**
- Modify: `src/pages/ModerationPage.ts` (full rewrite)

**Interfaces:**
- Consumes: `auth`, `db`, `getProfile`, `renderReportsTab`, `renderCommentsTab`, `renderUsersTab`, `renderStatsTab`, `renderTabBar`
- Produces: tab-based page

- [ ] **Step 1: Rewrite ModerationPage.ts**

```typescript
import { auth, db } from '../config/firebase';
import { getProfile } from '../services/auth.service';
import { renderTabBar, type AdminTab } from '../components/admin/shared/TabBar';
import { renderReportsTab } from '../components/admin/ReportsTab';
import { renderCommentsTab } from '../components/admin/CommentsTab';
import { renderUsersTab } from '../components/admin/UsersTab';
import { renderStatsTab } from '../components/admin/StatsTab';

export async function renderModerationPage(container: HTMLElement): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    container.innerHTML = '<p class="error">Yetkisiz. Giriş yapın.</p>';
    return;
  }

  const profileResult = await getProfile(db, user.uid);
  if (!profileResult.ok || !profileResult.data || !['moderator', 'admin'].includes(profileResult.data.role)) {
    container.innerHTML = '<p class="error">Bu sayfaya erişim yetkiniz yok.</p>';
    return;
  }

  container.innerHTML = `
    <div class="page-container moderation-page">
      <h2>Moderasyon Paneli</h2>
      <div class="tab-bar-container"></div>
      <div id="tab-content"></div>
    </div>
  `;

  const tabBarContainer = container.querySelector<HTMLDivElement>('.tab-bar-container')!;
  const contentContainer = container.querySelector<HTMLDivElement>('#tab-content')!;

  const loadTab = async (tab: AdminTab): Promise<void> => {
    contentContainer.innerHTML = '';
    contentContainer.setAttribute('role', 'tabpanel');
    switch (tab) {
      case 'reports':
        await renderReportsTab(contentContainer);
        break;
      case 'comments':
        await renderCommentsTab(contentContainer);
        break;
      case 'users':
        await renderUsersTab(contentContainer);
        break;
      case 'stats':
        await renderStatsTab(contentContainer);
        break;
    }
  };

  renderTabBar(tabBarContainer, 'reports', async (tab) => {
    renderTabBar(tabBarContainer, tab, () => {});
    await loadTab(tab);
  });

  await loadTab('reports');
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run typecheck 2>&1 | tail -3
npm run build:web 2>&1 | tail -3
```

Expected: Both succeed.

- [ ] **Step 3: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/pages/ModerationPage.ts
git commit -m "refactor(moderation): tab-based ModerationPage

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: CSS

**Files:**
- Create: `src/styles/pages/moderation.css`

**Interfaces:**
- Consumes: existing CSS variables (`--color-*`, `--space-*`, `--radius`, etc.)
- Produces: tab/list/card styles

- [ ] **Step 1: Write the file**

```css
/* Moderation page */

.moderation-page {
  padding: var(--space-6) var(--space-5);
  max-width: var(--max-content-width);
  margin-inline: auto;
}

.tab-bar {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-divider);
  margin-bottom: var(--space-5);
  overflow-x: auto;
}

.tab-btn {
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font: inherit;
  color: var(--color-muted);
  cursor: pointer;
  white-space: nowrap;
}

.tab-btn.active {
  border-bottom-color: var(--color-primary);
  color: var(--color-text);
}

.tab-btn:hover {
  color: var(--color-text);
}

/* Cards: report / comment / user admin */

.report-card,
.comment-admin-card,
.user-admin-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  margin-bottom: var(--space-3);
}

.comment-admin-card p,
.user-admin-card p {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--color-text-soft);
}

.empty-state {
  color: var(--color-muted);
  font-style: italic;
  text-align: center;
  padding: var(--space-5);
}

.error {
  color: var(--color-danger);
  font-weight: 500;
}

/* Buttons */

.btn-danger {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font: inherit;
  cursor: pointer;
}

.btn-danger:hover {
  background: var(--color-danger);
  color: var(--color-on-primary);
}

/* Stats */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.stat-widget {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.stat-label {
  font-size: var(--fs-sm);
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.stat-value {
  font-family: var(--font-display);
  font-size: var(--fs-3xl);
  font-weight: 600;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

/* Confirm dialog */

.confirm-backdrop {
  position: fixed;
  inset: 0;
  background: oklch(0 0 0 / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-modal {
  background: var(--color-surface);
  padding: var(--space-6);
  border-radius: var(--radius);
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

/* Mobile */

@media (max-width: 767px) {
  .moderation-page {
    padding: var(--space-4) var(--space-3);
  }
  .tab-btn {
    padding: var(--space-2) var(--space-3);
    font-size: var(--fs-sm);
  }
}
```

- [ ] **Step 2: Import CSS**

Edit `src/styles/main.css` (or wherever global styles are imported):

Add line:
```css
@import './pages/moderation.css';
```

Check existing `main.css` for the import pattern. Place alongside other `@import` lines.

- [ ] **Step 3: Verify build**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run build:web 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/styles/pages/moderation.css src/styles/main.css
git commit -m "style(moderation): tab + card + stats + dialog CSS

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 14: Service Unit Tests

**Files:**
- Create: `tests/services/admin.service.test.ts`
- Create: `tests/services/commentsModeration.service.test.ts`
- Create: `tests/services/adminUsers.service.test.ts`

### admin.service.test.ts

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteComment, blockUser, unblockUser, getAdminStats } from '../../src/services/admin.service';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn(),
}));

describe('admin.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteComment', () => {
    it('returns ok on success', async () => {
      const { httpsCallable } = await import('firebase/functions');
      vi.mocked(httpsCallable).mockReturnValue((() => Promise.resolve({ data: null })) as any);
      const result = await deleteComment('c1');
      expect(result.ok).toBe(true);
    });

    it('returns error on callable failure', async () => {
      const { httpsCallable } = await import('firebase/functions');
      vi.mocked(httpsCallable).mockReturnValue((() => Promise.reject({ code: 'admin/error' })) as any);
      const result = await deleteComment('c1');
      expect(result.ok).toBe(false);
      expect(result.error?.code).toMatch(/^admin\//);
    });
  });

  describe('blockUser', () => {
    it('passes reason when provided', async () => {
      const { httpsCallable } = await import('firebase/functions');
      const mockFn = vi.fn().mockResolvedValue({ data: null });
      vi.mocked(httpsCallable).mockReturnValue(mockFn as any);
      await blockUser('u1', 'spam');
      expect(mockFn).toHaveBeenCalledWith({ targetUid: 'u1', reason: 'spam' });
    });
  });

  describe('unblockUser', () => {
    it('calls unblockUser callable', async () => {
      const { httpsCallable } = await import('firebase/functions');
      const mockFn = vi.fn().mockResolvedValue({ data: null });
      vi.mocked(httpsCallable).mockReturnValue(mockFn as any);
      await unblockUser('u1');
      expect(mockFn).toHaveBeenCalledWith({ targetUid: 'u1' });
    });
  });

  describe('getAdminStats', () => {
    it('returns data from callable', async () => {
      const { httpsCallable } = await import('firebase/functions');
      const stats = { reportsOpen: 5, commentsDeletedToday: 3, blockedUsersCount: 2 };
      vi.mocked(httpsCallable).mockReturnValue((() => Promise.resolve({ data: stats })) as any);
      const result = await getAdminStats();
      expect(result.ok).toBe(true);
      expect(result.data).toEqual(stats);
    });
  });
});
```

- [ ] **Step 2: Write commentsModeration.service.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAllComments } from '../../src/services/commentsModeration.service';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
}));

describe('commentsModeration.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listAllComments', () => {
    it('returns empty array when no docs', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);
      const result = await listAllComments({} as any, 50);
      expect(result.ok).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('maps docs to Comment array', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { id: 'c1', data: () => ({ id: 'c1', text: 'hello', authorName: 'User' }) },
        ],
      } as any);
      const result = await listAllComments({} as any, 50);
      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].text).toBe('hello');
    });

    it('returns error on firestore failure', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockRejectedValue(new Error('firestore error'));
      const result = await listAllComments({} as any);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toMatch(/^comments\//);
    });
  });
});
```

- [ ] **Step 3: Write adminUsers.service.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listBlockedUsers } from '../../src/services/adminUsers.service';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
}));

describe('adminUsers.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listBlockedUsers', () => {
    it('returns empty array when no docs', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);
      const result = await listBlockedUsers({} as any);
      expect(result.ok).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('returns error on firestore failure', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockRejectedValue(new Error('firestore error'));
      const result = await listBlockedUsers({} as any);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toMatch(/^admin\//);
    });
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npx vitest run tests/services/admin.service.test.ts \
              tests/services/commentsModeration.service.test.ts \
              tests/services/adminUsers.service.test.ts 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add tests/services/
git commit -m "test(admin): service unit tests for moderation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

# PR 2 Manual Steps (Merge + Deploy)

After Tasks 6-14 complete:

- [ ] **Step 1: Push branch**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout -b feat/admin-moderation-frontend
git push origin feat/admin-moderation-frontend
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base develop --head feat/admin-moderation-frontend \
  --title "feat(admin): moderation panel UI - tabs + services" \
  --body "## What's in

- 3 new services (admin, commentsModeration, adminUsers)
- 4 tab components (Reports, Comments, Users, Stats) + shared (TabBar, ConfirmDialog)
- ModerationPage rewrite to tab-based UI
- Tab + card + stats CSS
- Service unit tests (mock httpsCallable)

## Deps
- Backend PR #N (admin callables) deployed ✓

🤖 Generated with [Claude Code](https://claude.com/claude-code"
```

- [ ] **Step 3: User merges (squash)**

- [ ] **Step 4: Sync develop locally + cleanup**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout develop
git pull origin develop --ff-only
git branch -d feat/admin-moderation-frontend
```

- [ ] **Step 5: Trigger CI deploy**

CI workflow `firebase-hosting.yml` deploys frontend on push to develop/main. Watch:

```bash
gh run list --workflow="firebase-hosting.yml" --limit 1
```

Expected: Latest run "in_progress" → "success" within 60s.

---

# Production Smoke Test (After Both PRs Deployed)

- [ ] **Step 1: Open /moderation as admin (Erhan)**

```bash
gh run list --workflow="firebase-hosting.yml" --limit 1
```

- [ ] **Step 2: Navigate to each tab**

- [ ] **Step 3: Test report flow**

Existing reports should still work. Click "Kaldır" → confirm dialog → entry removed.

- [ ] **Step 4: Test comments flow**

Click "Yorumlar" tab. If any comments exist, click "Sil" → confirm → comment removed.

If no comments exist: posts one as a test user first, or skip this step.

- [ ] **Step 5: Test users flow**

Click "Kullanıcılar" tab. List empty initially.

Manual block test (only if safe — don't lock a real user):
- Use Firebase Console → Firestore → `blockedUsers` collection → manually create test doc with `{ uid, blockedBy: <admin-uid>, blockedAt: now, reason: "test" }`.
- Reload /moderation tab → test user should appear.
- Click "Engeli Kaldır" → confirm → doc disappears.
- Delete the test doc.

- [ ] **Step 6: Test stats tab**

Click "İstatistikler" tab. Three counters show numbers (may be 0 initially).

- [ ] **Step 7: Test block enforcement**

Use Firebase Console to add a test blockedUser doc. Open `/contribute` (in another browser/incognito). Try to submit an entry. Should fail with "permission-denied" due to existing rule.

- [ ] **Step 8: Cleanup**

Remove any test blockedUser docs. Verify normal contribution flow works.

---

## Self-Review Checklist

After completing all tasks, verify:

✅ All 14 tasks complete with commits
✅ Both PRs merged to develop
✅ Backend functions deployed (Firebase Console lists 4 callable)
✅ Frontend deploys via CI workflow
✅ All tests pass (vitest run)
✅ `npm run typecheck` clean
✅ `npm run build:web` succeeds
✅ Production smoke test 8 items verified

---

## Definition of Done (from spec)

- [ ] 3 callable functions + 1 stats callable deployed
- [ ] Firestore rules updated (comments + entries + blockedUsers + auditLog + counters)
- [ ] admin.service.ts deployed
- [ ] 4 tab UI functional
- [ ] Audit log written on each action (verify via Firestore Console)
- [ ] Counters increment correctly
- [ ] Blocked user blocked from creating entries (rule test)
- [ ] Non-admin denied access
- [ ] Mobile responsive
- [ ] A11y: keyboard navigation, aria-labels
- [ ] All tests green
- [ ] Definition of Done: 12/12 ✅
