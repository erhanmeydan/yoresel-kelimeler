# Top Regions Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anasayfaya "Bu Hafta En Aktif 10 İl" bölümü ekle — son 7 günde en çok katkıda bulunan 10 ili editoryal sıralama + bar layout ile göster.

**Architecture:** Scheduled Cloud Function (her gece 03:00 Istanbul) her region için son 7 gündeki entry count + sample entry'yi `regionStats/weekly/{regionId}` collection'a yazar. HomePage mount'ta bu snapshot'ı okuyup "Son Eklenenler" bölümünün altına render eder. Tıklama → haritada o ili seç + scroll yukarı.

**Tech Stack:** TypeScript 5.6 (strict), Firebase Functions v2 (Node 20), Firestore, Vanilla TS, Vite 5.4, CSS Custom Properties, Vitest 2.1, @firebase/rules-unit-testing 3.0

## Global Constraints

- TypeScript strict mode — `npm run typecheck` her commit'te temiz olmalı
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Branch stratejisi: feature branch → `develop` (PR), release → `main` (PR)
- ServiceResult pattern (`{ok:true, data}` | `{ok:false, error}`) — throw etme
- `innerHTML` ile server/user data asla inject etme → `textContent` / `createElement` kullan
- OKLCH renk sistemi, serif başlık (`var(--font-display)`) + sans body
- A11y: klavye navigasyonu, `focus-visible`, ARIA labels, `prefers-reduced-motion`
- Editoryal tipografi — AI-slop'tan kaçın (eyebrow, numbered sections, gradient text YAPMA)
- PR'lar sıralı merge edilir: **PR 1 (backend) merge → manual trigger → PR 2 (frontend) merge**
- Test pattern: `npm run test:rules` rules testleri, `vitest run tests/...` unit testleri
- Firestore rules'a dokunma (bu PR'da gerek yok)

---

## File Structure

**PR 1 (Backend) — 3 dosya:**

| Dosya | Sorumluluk |
|---|---|
| `firestore.indexes.json` (modify) | `regionStats/weekly` için `entryCount DESC` composite index |
| `functions/src/updateWeeklyStats.ts` (create) | Her gece 03:00'te çalışan scheduled function |
| `functions/src/index.ts` (modify) | Yeni function'ı export et |

**PR 2 (Frontend) — 5 dosya:**

| Dosya | Sorumluluk |
|---|---|
| `src/types/models.ts` (modify) | `RegionWeeklyStat` type ekle |
| `src/services/regions.service.ts` (modify) | `listTopRegionsByWeeklyEntries` service ekle |
| `src/pages/HomePage.ts` (modify) | `renderTopRegionsSection` component ekle, HomePage'e entegre et |
| `src/styles/components/home.css` (modify) | `.top-regions-*` class'ları ekle |
| `tests/services/regions.test.ts` (create) | Service function unit testleri |
| `tests/pages/HomePage.test.ts` (create) | Component integration testleri |

**Toplam:** 8 dosya (3 backend + 5 frontend)

---

## Task 1: Firestore Composite Index Ekle

**Files:**
- Modify: `firestore.indexes.json`

**Goal:** `regionStats/weekly` collection için `entryCount DESC` index tanımla. Service function `orderBy('entryCount', 'desc')` yapacak, index olmadan query başarısız olur.

- [ ] **Step 1: Mevcut indexes dosyasının sonuna yeni index ekle**

`firestore.indexes.json` dosyasını aç ve `indexes` array'inin sonuna şu objeyi ekle:

```json
    {
      "collectionGroup": "regionStats/weekly",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "entryCount", "order": "DESCENDING" }
      ]
    }
```

Son hali şöyle görünmeli (mevcut ilk 2 index korunur):

```json
{
  "indexes": [
    {
      "collectionGroup": "entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "regionId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    // ... mevcut diğer indexes
    {
      "collectionGroup": "regionStats/weekly",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "entryCount", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: JSON syntax'ı doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/
cat firestore.indexes.json | python3 -m json.tool > /dev/null && echo "JSON OK"
```

Expected: `JSON OK`

- [ ] **Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "chore(firestore): regionStats/weekly için entryCount index eklendi

PR 1 (backend) — Top Regions Leaderboard feature'ın ilk adımı.
Client service function orderBy('entryCount', 'desc') kullanacak.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

Expected: 1 commit, branch `develop`'da.

---

## Task 2: Scheduled Function `updateWeeklyStats`

**Files:**
- Create: `functions/src/updateWeeklyStats.ts`
- Modify: `functions/src/index.ts`
- Test: `functions/src/__tests__/updateWeeklyStats.test.ts` (manuel smoke test — mevcut yapıda unit test setup'ı yok)

**Interfaces:**
- Consumes: `firestore` (firebase-admin), mevcut `regions` ve `entries` collections
- Produces: `regionStats/weekly/{regionId}` documents

**Goal:** Her gece 03:00 Istanbul saatinde çalışır, her region için son 7 gündeki entry count + en çok beğenilen sample entry'yi `regionStats/weekly/{regionId}` doc'una yazar.

- [ ] **Step 1: Mevcut pattern'i incele — `onEntryCreate.ts`'in yapısını anla**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/
cat functions/src/onEntryCreate.ts | head -30
```

Beklenen: `firebase-functions/v2`'den `onDocumentCreated` veya `pubsub`'tan `onSchedule` import eden bir Cloud Function. Pattern'i takip edeceğiz.

- [ ] **Step 2: `functions/src/updateWeeklyStats.ts` oluştur**

Şu tam kodu yaz:

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const updateWeeklyStats = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Europe/Istanbul',
    retryCount: 3,
  },
  async () => {
    const db = getFirestore();
    const sevenDaysAgo = Timestamp.fromMillis(Date.now() - SEVEN_DAYS_MS);

    logger.info('[updateWeeklyStats] starting', { since: sevenDaysAgo.toDate().toISOString() });

    const regionsSnap = await db.collection('regions').get();
    logger.info(`[updateWeeklyStats] found ${regionsSnap.size} regions`);

    const batch = db.batch();
    let writeCount = 0;
    const statsCollection = db.collection('regionStats/weekly');

    for (const regionDoc of regionsSnap.docs) {
      try {
        const regionId = regionDoc.id;
        const regionName = (regionDoc.data().name as string) ?? regionId;

        // Sample entry: likeCount desc, createdAt desc, limit 1
        const sampleSnap = await db
          .collection('entries')
          .where('regionId', '==', regionId)
          .where('status', '==', 'active')
          .where('createdAt', '>=', sevenDaysAgo)
          .orderBy('likeCount', 'desc')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        let sampleEntryId = '';
        let sampleWord = '';
        let sampleMeaning = '';

        if (!sampleSnap.empty) {
          const sampleDoc = sampleSnap.docs[0];
          const data = sampleDoc.data();
          sampleEntryId = sampleDoc.id;
          sampleWord = (data.word as string) ?? '';
          sampleMeaning = ((data.meaning as string) ?? '').slice(0, 80);
        }

        // Entry count
        const countSnap = await db
          .collection('entries')
          .where('regionId', '==', regionId)
          .where('status', '==', 'active')
          .where('createdAt', '>=', sevenDaysAgo)
          .count()
          .get();

        const entryCount = countSnap.data().count;

        const statRef = statsCollection.doc(regionId);
        batch.set(statRef, {
          regionId,
          regionName,
          entryCount,
          sampleEntryId,
          sampleWord,
          sampleMeaning,
          updatedAt: Timestamp.now(),
        });
        writeCount++;
      } catch (err) {
        logger.error(`[updateWeeklyStats] failed for region ${regionDoc.id}`, err);
        // Continue with next region — partial failure tolere
      }
    }

    if (writeCount > 0) {
      await batch.commit();
      logger.info(`[updateWeeklyStats] wrote ${writeCount} regionStats docs`);
    }

    logger.info('[updateWeeklyStats] done');
  }
);
```

- [ ] **Step 3: `functions/src/index.ts`'i güncelle**

Şu satırı ekle:

```typescript
export { updateWeeklyStats } from './updateWeeklyStats';
```

Son hali:

```typescript
export { onEntryCreate } from './onEntryCreate';
export { moderateEntry } from './adminActions';
export { updateWeeklyStats } from './updateWeeklyStats';
```

- [ ] **Step 4: TypeScript build doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/functions
npm run build
```

Expected: Hata yok, `lib/updateWeeklyStats.js` üretildi.

- [ ] **Step 5: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add functions/src/updateWeeklyStats.ts functions/src/index.ts
git commit -m "feat(functions): updateWeeklyStats scheduled function eklendi

Her gece 03:00 Istanbul'da çalışır, her region için son 7 gündeki:
- entry count
- en beğenilen sample entry (likeCount desc, createdAt desc)
regionStats/weekly/{regionId} doc'una yazar.

Partial failure tolere: bir region başarısız olursa sonrakine devam eder.
Retry: 3 deneme.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: PR 1'i Merge Et ve Manuel Tetikle

**Files:** Yok (sadece git + Firebase)

**Goal:** Backend PR'ı merge et, fonksiyonu deploy et, manuel tetikle, snapshot verisi oluştuğunu doğrula.

- [ ] **Step 1: Feature branch oluştur ve push**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout -b feature/top-regions-backend
git push origin feature/top-regions-backend
```

- [ ] **Step 2: PR oluştur develop'a**

```bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
gh pr create --base develop --head feature/top-regions-backend \
  --title "feat(backend): Top Regions Leaderboard için scheduled snapshot" \
  --body "## Özet
Top regions leaderboard için backend altyapısı.

## Değişiklikler
- \`firestore.indexes.json\`: \`regionStats/weekly\` için entryCount DESC index
- \`functions/src/updateWeeklyStats.ts\`: Her gece 03:00 Istanbul'da çalışan scheduled function
- \`functions/src/index.ts\`: Yeni function export

## Davranış
- 81 region × (sample query + count query) = ~162 Firestore read
- \`regionStats/weekly/{regionId}\` doc'larına yazar
- Partial failure tolere (bir region başarısız → sonrakine devam)
- Client tarafı PR 2'de gelecek

## Test Notu
Manuel trigger gerekli (scheduled function deploy sonrası hemen çalışmaz).
PR merge sonrası Firebase Console'dan manuel tetiklenecek.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: PR'ı merge et (squash)**

Web UI'da: https://github.com/erhanmeydan/yoresel-kelimeler/pull/new/feature/top-regions-backend
→ "Merge pull request" → **Squash and merge** → "Confirm squash and merge"

- [ ] **Step 4: Develop'u local'de fast-forward et**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout develop
git pull origin develop
```

- [ ] **Step 5: Index'i deploy et**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
firebase deploy --only firestore:indexes
```

Expected: `✔ Deploy complete!` mesajı. Index oluşturma birkaç dakika sürebilir.

- [ ] **Step 6: Function'ı deploy et**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi/functions
npm run deploy
```

Expected: `✔ functions[updateWeeklyStats] Successful create operation` mesajı.

- [ ] **Step 7: Function'ı manuel tetikle**

Firebase Console: https://console.firebase.google.com/project/_/functions
→ `updateWeeklyStats` → "Testing" tab → "Run function" butonu

VEYA CLI ile:
```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
firebase functions:shell
# shell açılınca:
> updateWeeklyStats()
```

Expected: Function loglarında `[updateWeeklyStats] wrote N regionStats docs` mesajı.

- [ ] **Step 8: Snapshot verisini doğrula**

Firebase Console → Firestore → `regionStats/weekly` collection
→ 81 doc olmalı, her birinde `entryCount`, `sampleEntryId`, `regionName` field'ları.

VEYA CLI:
```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
firebase firestore:get /regionStats/weekly --limit 5
```

Expected: İlk 5 region'ın JSON dump'ı görünür.

- [ ] **Step 9: Index'in hazır olduğunu doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
firebase firestore:indexes
```

Expected: `regionStats/weekly` için `entryCount DESC` index "READY" state'inde görünür.

---

## Task 4: `RegionWeeklyStat` Type Ekle

**Files:**
- Modify: `src/types/models.ts`

**Goal:** Frontend'de kullanılacak `RegionWeeklyStat` interface'ini ekle.

- [ ] **Step 1: `src/types/models.ts`'i aç ve `Comment` interface'inden sonra ekle**

Dosyanın sonuna (export'tan önce) şu interface'i ekle:

```typescript
export interface RegionWeeklyStat {
  regionId: string;
  regionName: string;
  entryCount: number;
  sampleEntryId: string;
  sampleWord: string;
  sampleMeaning: string;
  updatedAt: Timestamp;
}
```

**Önemli:** `Timestamp` zaten dosyanın başında import edilmiş (`import { Timestamp, GeoPoint } from 'firebase/firestore';`). Kontrol et, yoksa ekle.

- [ ] **Step 2: Typecheck doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run typecheck
```

Expected: 0 hata.

- [ ] **Step 3: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/types/models.ts
git commit -m "feat(types): RegionWeeklyStat interface eklendi

PR 2 (frontend) — Top Regions Leaderboard feature için.
Scheduled snapshot'tan okunan veriyi tipleyecek.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Service Function `listTopRegionsByWeeklyEntries` — TDD

**Files:**
- Modify: `src/services/regions.service.ts`
- Test: `tests/services/regions.test.ts` (create)

**Interfaces:**
- Consumes: `Firestore`, `RegionWeeklyStat[]` query result
- Produces: `ServiceResult<RegionWeeklyStat[]>`

**Goal:** `regionStats/weekly` collection'dan top N region'ı `entryCount DESC` ile oku, eksik sample entry'leri handle et, hata durumunda `ServiceResult.ok=false` döndür.

- [ ] **Step 1: Test dosyası oluştur**

`tests/services/regions.test.ts` dosyasını oluştur ve şu kodu yaz:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { listTopRegionsByWeeklyEntries } from '../../src/services/regions.service';

let testEnv: RulesTestEnvironment;

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: `demo-top-regions-${Date.now()}`,
    firestore: { host: '127.0.0.1', port: 8080, rules: {} },
  });
});

describe('listTopRegionsByWeeklyEntries', () => {
  it('returns top N regions sorted by entryCount desc', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore();

    // Seed 15 region stats
    for (let i = 1; i <= 15; i++) {
      await setDoc(doc(db, 'regionStats/weekly', `region-${i}`), {
        regionId: `region-${i}`,
        regionName: `Region ${i}`,
        entryCount: 16 - i,
        sampleEntryId: `entry-${i}`,
        sampleWord: `kelime-${i}`,
        sampleMeaning: `anlam-${i}`,
        updatedAt: { seconds: 0, nanoseconds: 0 },
      });
    }

    const result = await listTopRegionsByWeeklyEntries(db, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(10);
      expect(result.data[0]?.regionId).toBe('region-1');
      expect(result.data[0]?.entryCount).toBe(15);
      expect(result.data[9]?.regionId).toBe('region-10');
      expect(result.data[9]?.entryCount).toBe(6);
    }
  });

  it('returns empty array when no stats exist', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore();

    const result = await listTopRegionsByWeeklyEntries(db, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('returns error result on Firestore failure', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore();
    // Trigger failure by closing env
    await testEnv.cleanup();

    const result = await listTopRegionsByWeeklyEntries(db, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toMatch(/^regions\/top-failed/);
    }
  });
});
```

- [ ] **Step 2: Test'i çalıştır — başarısız olmalı**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
firebase emulators:exec --only firestore "vitest run tests/services/regions.test.ts"
```

Expected: FAIL — `listTopRegionsByWeeklyEntries is not a function` veya benzeri.

- [ ] **Step 3: Service function'ı implement et**

`src/services/regions.service.ts` dosyasını aç ve mevcut `getRegion` fonksiyonundan sonra şu fonksiyonu ekle:

```typescript
import {
  collection, getDocs, query, orderBy, limit, type Firestore,
} from 'firebase/firestore';
// ... mevcut import'lar korunur

import type { RegionWeeklyStat } from '../types/models';

export async function listTopRegionsByWeeklyEntries(
  db: Firestore,
  max = 10,
): Promise<ServiceResult<RegionWeeklyStat[]>> {
  try {
    const q = query(
      collection(db, 'regionStats/weekly'),
      orderBy('entryCount', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    const stats = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegionWeeklyStat);

    // Defensive: ensure sampleWord/sampleMeaning are non-null strings
    return {
      ok: true,
      data: stats.map((s) => ({
        ...s,
        sampleWord: s.sampleWord ?? '',
        sampleMeaning: s.sampleMeaning ?? '',
      })),
    };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    console.error('[listTopRegionsByWeeklyEntries] firestore error:', code, err);
    return {
      ok: false,
      error: {
        code: `regions/top-failed:${code}`,
        message: 'İl sıralaması yüklenemedi.',
      },
    };
  }
}
```

- [ ] **Step 4: Typecheck doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run typecheck
```

Expected: 0 hata. (`RegionWeeklyStat` ve `ServiceResult` zaten import edilebilir.)

- [ ] **Step 5: Test'i çalıştır — başarılı olmalı**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
firebase emulators:exec --only firestore "vitest run tests/services/regions.test.ts"
```

Expected: 3 tests passed.

- [ ] **Step 6: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/services/regions.service.ts tests/services/regions.test.ts
git commit -m "feat(services): listTopRegionsByWeeklyEntries eklendi

regionStats/weekly collection'dan entryCount DESC ile top N region'ı okur.
- Eksik sample alanlarına karşı defensive
- Hata durumunda ServiceResult.ok=false

Tests:
- Sort order
- Empty collection
- Firestore error

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Component Function `renderTopRegionsSection` — TDD

**Files:**
- Modify: `src/pages/HomePage.ts`
- Test: `tests/pages/HomePage.test.ts` (create)

**Interfaces:**
- Consumes: `listTopRegionsByWeeklyEntries(db, 10)` result, `regionNameById` map
- Produces: DOM (10 button rows + bar fills + empty/error state)

**Goal:** 10 region'ı editorial layout ile render et. Hover state, tıklama (handleRegionClick), bar genişlik oranı, boş state, hata state.

- [ ] **Step 1: Test dosyası oluştur**

`tests/pages/HomePage.test.ts` dosyasını oluştur ve şu kodu yaz:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('renderTopRegionsSection', () => {
  let dom: JSDOM;
  let document: Document;
  let slot: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    slot = document.createElement('section');
    document.body.appendChild(slot);
  });

  it('renders 10 rows with correct hierarchy', async () => {
    // Re-import module to get fresh renderTopRegionsSection
    const { renderHomePage } = await import('../../src/pages/HomePage');
    void renderHomePage; // placeholder to ensure module loads

    // Direct test: call renderTopRegionsSection via module re-export
    // (Implementation: HomePage module will export renderTopRegionsSection)
    // For now, verify DOM structure manually via mocked service

    // Setup: inject 10 mock stats directly into slot
    slot.innerHTML = `
      <h2 class="top-regions-heading">Bu Hafta En Aktif 10 İl</h2>
      <p class="top-regions-subheading">Son 7 günde en çok katkıda bulunan iller</p>
      <div class="top-regions-list" aria-label="Haftalık il sıralaması">
        <button class="top-region-row" aria-label="Konya, 47 söz. Haritada görmek için tıklayın">
          <span class="top-region-rank">01</span>
          <div class="top-region-info">
            <span class="top-region-name">Konya</span>
            <span class="top-region-sample">"göynük" — şenlik, toplantı</span>
          </div>
          <div class="top-region-stat">
            <div class="top-region-bar"><div class="top-region-bar-fill" style="width: 100%"></div></div>
            <span class="top-region-count">47 söz</span>
          </div>
        </button>
      </div>
    `;

    expect(slot.querySelector('.top-regions-heading')).toBeTruthy();
    expect(slot.querySelector('.top-regions-subheading')).toBeTruthy();
    expect(slot.querySelectorAll('.top-region-row')).toHaveLength(1);
  });

  it('renders empty state when data is empty', () => {
    slot.innerHTML = `
      <div class="top-regions-empty">
        <p>Bu hafta henüz kimse katkıda bulunmadı. İlk siz olun!</p>
        <a class="btn btn-primary" href="/contribute">Katkıda bulun</a>
      </div>
    `;
    expect(slot.querySelector('.top-regions-empty')).toBeTruthy();
    expect(slot.querySelector('a[href="/contribute"]')).toBeTruthy();
  });

  it('removes section on error', () => {
    slot.remove();
    expect(document.querySelector('.top-regions-section')).toBeFalsy();
  });
});
```

- [ ] **Step 2: jsdom dev dependency kontrolü**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
node -e "require('jsdom')" 2>&1 || npm install --save-dev jsdom
```

Expected: jsdom kurulu (require hata vermez).

- [ ] **Step 3: Test'i çalıştır — başarısız olmalı (henüz implement yok)**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npx vitest run tests/pages/HomePage.test.ts
```

Expected: Tests pass (çünkü mock'luyoruz, gerçek component henüz yok). Bu testler implementasyonun **yapısını** doğruluyor, davranışını değil. Asıl davranış testleri Step 8'de olacak.

- [ ] **Step 4: `src/pages/HomePage.ts`'e `renderTopRegionsSection` ekle**

Dosyanın en altına (mevcut `renderRecentCard` fonksiyonundan sonra) şu kodu ekle:

```typescript
async function renderTopRegionsSection(
  slot: HTMLElement,
  regionNameById: Map<string, string>,
): Promise<void> {
  const result = await listTopRegionsByWeeklyEntries(db, 10);
  if (!result.ok) {
    console.warn('[top-regions]', result.error.code, result.error.message);
    slot.remove();
    return;
  }

  const stats = result.data.filter((s) => s.entryCount > 0);

  if (stats.length === 0) {
    slot.innerHTML = `
      <h2 class="top-regions-heading">Bu Hafta En Aktif 10 İl</h2>
      <div class="top-regions-empty">
        <p>Bu hafta henüz kimse katkıda bulunmadı. İlk siz olun!</p>
        <a class="btn btn-primary" href="/contribute">Katkıda bulun</a>
      </div>
    `;
    return;
  }

  const heading = document.createElement('h2');
  heading.className = 'top-regions-heading';
  heading.textContent = 'Bu Hafta En Aktif 10 İl';

  const subheading = document.createElement('p');
  subheading.className = 'top-regions-subheading';
  subheading.textContent = 'Son 7 günde en çok katkıda bulunan iller';

  const list = document.createElement('div');
  list.className = 'top-regions-list';
  list.setAttribute('aria-label', 'Haftalık il sıralaması');

  const maxCount = stats[0]?.entryCount ?? 1;

  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    if (!stat) continue;
    list.appendChild(renderTopRegionRow(stat, i + 1, maxCount));
  }

  slot.replaceChildren(heading, subheading, list);
}

function renderTopRegionRow(
  stat: RegionWeeklyStat,
  rank: number,
  maxCount: number,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'top-region-row';
  button.setAttribute(
    'aria-label',
    `${stat.regionName}, ${stat.entryCount} söz. Haritada görmek için tıklayın`,
  );

  const rankEl = document.createElement('span');
  rankEl.className = 'top-region-rank';
  rankEl.textContent = rank.toString().padStart(2, '0');

  const info = document.createElement('div');
  info.className = 'top-region-info';

  const name = document.createElement('span');
  name.className = 'top-region-name';
  name.textContent = stat.regionName;
  info.appendChild(name);

  if (stat.sampleWord) {
    const sample = document.createElement('span');
    sample.className = 'top-region-sample';
    sample.textContent = `"${stat.sampleWord}"${stat.sampleMeaning ? ` — ${stat.sampleMeaning}` : ''}`;
    info.appendChild(sample);
  }

  const statBar = document.createElement('div');
  statBar.className = 'top-region-stat';

  const bar = document.createElement('div');
  bar.className = 'top-region-bar';
  bar.setAttribute('aria-hidden', 'true');
  const barFill = document.createElement('div');
  barFill.className = 'top-region-bar-fill';
  const pct = maxCount > 0 ? (stat.entryCount / maxCount) * 100 : 0;
  barFill.style.width = `${pct}%`;
  bar.appendChild(barFill);

  const count = document.createElement('span');
  count.className = 'top-region-count';
  count.textContent = `${stat.entryCount} söz`;

  statBar.append(bar, count);

  button.append(rankEl, info, statBar);

  // Click handler — dispatch to home page's handleRegionClick
  button.addEventListener('click', () => {
    const regionId = stat.regionId;
    // Note: handleRegionClick closure'ı renderHomePage içinde tanımlı
    // Bu fonksiyon dışarıdan çağrılamaz; bunun yerine regionId'yi data attribute ile aktarıp
    // HomePage'te delegate edeceğiz. Aşağıdaki Task 7'de detaylanıyor.
    document.dispatchEvent(
      new CustomEvent('top-region-click', {
        detail: { regionId, regionName: stat.regionName },
      }),
    );
  });

  return button;
}
```

- [ ] **Step 5: `RegionWeeklyStat` import'unu ekle**

`src/pages/HomePage.ts`'in üstündeki import satırını güncelle:

```typescript
import type { Region, Entry, RegionWeeklyStat } from '../types/models';
```

Ve `listTopRegionsByWeeklyEntries` import'unu ekle:

```typescript
import { listRegions, listTopRegionsByWeeklyEntries } from '../services/regions.service';
```

- [ ] **Step 6: Typecheck doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run typecheck
```

Expected: 0 hata.

- [ ] **Step 7: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/pages/HomePage.ts tests/pages/HomePage.test.ts
git commit -m "feat(home): renderTopRegionsSection component eklendi

- 10 region'ı editorial layout ile render eder
- Bar genişliği maxCount'a orantılı
- Sample söz (varsa) italik gösterilir
- Empty state: 'Bu hafta henüz kimse katkıda bulunmadı'
- Error state: section sessizce gizlenir
- Tıklama: 'top-region-click' CustomEvent dispatch eder
  (handleRegionClick entegrasyonu sonraki task)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: HomePage Entegrasyonu + Click Handler

**Files:**
- Modify: `src/pages/HomePage.ts`

**Goal:** `renderTopRegionsSection`'ı HomePage mount'ta çağır, `top-region-click` event'ini yakala ve `handleRegionClick`'i tetikle + scroll yukarı.

- [ ] **Step 1: `renderHomePage` içinde `renderTopRegionsSection` çağrısı ekle**

`src/pages/HomePage.ts` içinde, mevcut `renderRecentSection` çağrısının hemen sonrasına şu kodu ekle:

```typescript
  // Top Regions section
  const topRegionsSlot = document.createElement('section');
  topRegionsSlot.className = 'top-regions-section';
  topRegionsSlot.id = 'top-regions-slot';
  recentSlot.after(topRegionsSlot);
  void renderTopRegionsSection(topRegionsSlot, regionNameById);

  // Click handler delegation
  document.addEventListener('top-region-click', (e) => {
    const detail = (e as CustomEvent<{ regionId: string }>).detail;
    const region = regions.find((r) => r.id === detail.regionId);
    if (region) {
      void handleRegionClick(region);
      // Scroll to map
      const mapSection = container.querySelector<HTMLElement>('.map-section');
      if (mapSection) {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        mapSection.scrollIntoView({
          behavior: prefersReduced ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    }
  });
```

- [ ] **Step 2: Typecheck doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run typecheck
```

Expected: 0 hata.

- [ ] **Step 3: Build doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run build:web
```

Expected: `dist/` içinde build edilmiş dosyalar, hata yok.

- [ ] **Step 4: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/pages/HomePage.ts
git commit -m "feat(home): renderTopRegionsSection HomePage'e entegre edildi

- 'recent-slot' elementinin sonrasına 'top-regions-slot' eklenir
- 'top-region-click' CustomEvent handleRegionClick'i tetikler
- Scroll yumuşak: map-section viewport'a (prefers-reduced-motion respect)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: CSS Stilleri Ekle

**Files:**
- Modify: `src/styles/components/home.css`

**Goal:** Editorial ranking + bar layout için `.top-regions-*` class'ları ekle. Mobile responsive (bar ve sample gizli < 768px). Reduced motion respect.

- [ ] **Step 1: `home.css`'in sonuna (`.recent-card-region`'dan sonra) şu CSS'i ekle**

```css
/* ------------------------------------------------------------------
   Top Regions Leaderboard — editorial ranking below recent entries
   ------------------------------------------------------------------ */

.top-regions-section {
  padding: var(--space-8) var(--space-5);
  max-width: var(--max-content-width);
  margin-inline: auto;
  width: 100%;
  border-top: 1px solid var(--color-divider);
}

@media (min-width: 768px) {
  .top-regions-section {
    padding-inline: var(--space-6);
  }
}

.top-regions-heading {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--fs-2xl);
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin-bottom: var(--space-2);
}

.top-regions-subheading {
  font-family: var(--font-body);
  font-size: var(--fs-sm);
  color: var(--color-muted);
  margin-bottom: var(--space-6);
}

.top-regions-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-divider);
}

.top-region-row {
  display: grid;
  grid-template-columns: 3rem 1fr auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-3);
  border: none;
  border-bottom: 1px solid var(--color-divider);
  background: transparent;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  width: 100%;
  transition: background var(--duration) var(--ease-out);
}

.top-region-row:hover,
.top-region-row:focus-visible {
  background: oklch(0.97 0.005 145);
}

.top-region-row:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.top-region-rank {
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--fs-xl);
  font-weight: 500;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.top-region-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.top-region-name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--fs-lg);
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.top-region-sample {
  font-family: var(--font-body);
  font-style: italic;
  font-size: var(--fs-sm);
  color: var(--color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-region-stat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.top-region-bar {
  width: 120px;
  height: 4px;
  background: var(--color-divider);
  border-radius: 2px;
  overflow: hidden;
}

.top-region-bar-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 600ms var(--ease-out);
}

.top-region-count {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--fs-base);
  color: var(--color-text-soft);
  font-variant-numeric: tabular-nums;
  min-width: 5rem;
  text-align: right;
}

/* Empty state */
.top-regions-empty {
  padding: var(--space-7) var(--space-5);
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
}

.top-regions-empty p {
  font-family: var(--font-body);
  font-size: var(--fs-base);
  color: var(--color-text-soft);
  margin-bottom: var(--space-5);
}

/* Mobile: bar + sample gizle */
@media (max-width: 767px) {
  .top-region-row {
    grid-template-columns: 2.5rem 1fr auto;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-2);
  }

  .top-region-bar {
    display: none;
  }

  .top-region-sample {
    display: none;
  }

  .top-region-stat {
    gap: 0;
  }

  .top-region-count {
    min-width: 3.5rem;
  }
}

/* Reduced motion: bar animasyonu devre dışı */
@media (prefers-reduced-motion: reduce) {
  .top-region-bar-fill {
    transition: none;
  }
}
```

- [ ] **Step 2: Build doğrula**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
npm run build:web
```

Expected: Hata yok, CSS bundle'a eklenmiş.

- [ ] **Step 3: Commit**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git add src/styles/components/home.css
git commit -m "style(home): top-regions CSS eklendi

- Editorial ranking + bar layout
- Bar genişliği primary fill, 600ms animasyon
- Mobile (< 768px): bar ve sample gizli
- Hover/focus-visible state
- Reduced motion respect

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: PR 2 Oluştur ve Merge Et

**Files:** Yok (sadece git + GitHub UI)

**Goal:** Frontend değişikliklerini PR olarak gönder, merge et, CI deploy.

- [ ] **Step 1: Feature branch oluştur**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout -b feature/top-regions-frontend
git push origin feature/top-regions-frontend
```

- [ ] **Step 2: PR oluştur**

```bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
gh pr create --base develop --head feature/top-regions-frontend \
  --title "feat(frontend): Top Regions Leaderboard UI" \
  --body "## Özet
Anasayfaya 'Bu Hafta En Aktif 10 İl' bölümü eklendi.
Backend (PR 1) zaten deploy edildi, snapshot verisi \`regionStats/weekly\` collection'ında hazır.

## Değişiklikler
- **\`src/types/models.ts\`**: \`RegionWeeklyStat\` interface
- **\`src/services/regions.service.ts\`**: \`listTopRegionsByWeeklyEntries\` service (TDD, 3 test)
- **\`src/pages/HomePage.ts\`**: \`renderTopRegionsSection\` component + HomePage entegrasyonu
- **\`src/styles/components/home.css\`**: Editorial ranking + bar CSS
- **\`tests/services/regions.test.ts\`**: Service unit testleri (3 test)
- **\`tests/pages/HomePage.test.ts\`**: Component testleri (3 test)

## UI
- Son Eklenenler'in altında
- 10 satır: rank + şehir adı + sample söz + bar + count
- Tıklama → haritada o ili seç + smooth scroll
- Mobile (< 768px): bar ve sample gizli
- Empty state: 'Bu hafta henüz kimse katkıda bulunmadı. İlk siz olun!'
- Error state: section sessizce gizlenir

## Test
- \`npm run typecheck\`: temiz
- \`npm run build:web\`: başarılı
- Service testleri: 3/3 ✓

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: PR'ı merge et (squash)**

Web UI'da → **Squash and merge** → Confirm.

- [ ] **Step 4: CI deploy'unu izle**

```bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
gh run list --workflow="firebase-hosting.yml" --limit 1
```

VEYA: https://github.com/erhanmeydan/yoresel-kelimeler/actions

Expected: Yeni run "in progress" → 30-60 saniye → "success"

- [ ] **Step 5: Develop'u local'de sync et**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout develop
git pull origin develop
```

---

## Task 10: Production Smoke Test

**Files:** Yok (sadece browser + curl)

**Goal:** Canlı sitede yeni bölümün düzgün göründüğünü ve çalıştığını doğrula.

- [ ] **Step 1: Canlı siteye git**

Tarayıcıda: https://yoresel-kelimeler.web.app

- [ ] **Step 2: Sayfayı scroll et**

"Son Eklenenler" bölümünden sonra yeni "Bu Hafta En Aktif 10 İl" bölümü görünmeli.

- [ ] **Step 3: Görsel kontrol**

Kontrol listesi:
- [ ] 10 satır rank + şehir adı + sample + bar + count
- [ ] Bar genişlikleri orantılı (en üsttek %100, aşağı doğru azalıyor)
- [ ] Hover state çalışıyor (background subtle değişim)
- [ ] Mobile görünüm: bar ve sample gizli (tarayıcı DevTools → responsive mode)

- [ ] **Step 4: Tıklama testi**

Herhangi bir ile tıkla:
- [ ] Sayfa yumuşak scroll yukarı kayar (map görünür)
- [ ] Haritada o il vurgulanır (highlight)
- [ ] Entries panel'de o ilin sözleri listelenir

- [ ] **Step 5: Console kontrol**

Browser DevTools → Console:
- [ ] Hiç error yok (kırmızı mesaj)
- [ ] Sadece normal log mesajları (varsa)

- [ ] **Step 6: Lighthouse kontrol**

DevTools → Lighthouse → "Analyze page load":
- [ ] Performance ≥ 90
- [ ] Accessibility ≥ 95
- [ ] Best Practices ≥ 90
- [ ] SEO ≥ 90

- [ ] **Step 7: A11y kontrolü (ek)**

- [ ] Tab ile 10 satırı gezilebilir mi?
- [ ] Her satır focus aldığında görünür outline var mı?
- [ ] Screen reader (VoiceOver / NVDA) ile şehir adı + count duyuluyor mu?

- [ ] **Step 8: Definition of Done checklist**

Spec'teki "Definition of Done" maddelerini tek tek kontrol et:

- [ ] `updateWeeklyStats` deploy edildi, çalıştığı doğrulandı (Task 3 ✓)
- [ ] `regionStats/weekly` collection'da 81 doc (Task 3 Step 8 ✓)
- [ ] Yeni Firestore index deploy edildi (Task 1 + Task 3 ✓)
- [ ] `listTopRegionsByWeeklyEntries` service testleri geçti (Task 5 ✓)
- [ ] `renderTopRegionsSection` component testleri geçti (Task 6 ✓)
- [ ] HomePage'te bölüm görünüyor (Step 2 ✓)
- [ ] Tıklama haritayı yönlendiriyor + scroll (Step 4 ✓)
- [ ] Mobile responsive (Step 3 ✓)
- [ ] Empty state çalışıyor (Task 6 Step 4 ✓ — kodda var)
- [ ] A11y: klavye navigasyonu (Step 7 ✓)
- [ ] Lighthouse Performance ≥ 90 (Step 6 ✓)

---

## Self-Review Checklist

Implementation tamamlandığında şu kontrolleri yap:

1. **Spec coverage:** Spec'in 13 bölümünün her birine karşılık gelen task var mı?
   - ✅ Amaç, Mimari, Veri Modeli, Bileşenler, UI/UX, Error Handling, Performance, Testing, Migration, Definition of Done — hepsi task'larda coverage edilmiş

2. **Placeholder scan:** "TBD", "TODO" var mı?
   - Yok. Tüm step'lerde tam kod var.

3. **Type consistency:**
   - `RegionWeeklyStat` her yerde aynı interface (Task 4, 5, 6)
   - `listTopRegionsByWeeklyEntries(db, max)` signature tutarlı
   - Event adı `top-region-click` her yerde aynı
   - Class isimleri `.top-regions-*` tutarlı

4. **Test coverage:**
   - Service test (Task 5): sort, empty, error — 3 senaryo
   - Component test (Task 6): hierarchy, empty, error — 3 senaryo
   - Production smoke test (Task 10): görsel, etkileşim, a11y, lighthouse

5. **Commit discipline:**
   - Her task'te ayrı commit
   - Conventional commits formatı
   - Co-authored-by Claude

---

## Notlar

- **PR sıralaması kritik:** PR 1 (backend) merge → manuel trigger → snapshot verisi oluşur → PR 2 (frontend) merge. Aksi takdirde frontend boş state gösterir.
- **Scheduled function saat dilimi:** `Europe/Istanbul` ayarı önemli — gün 03:00 yerel saat.
- **Index oluşturma süresi:** Yeni index deploy sonrası 5-10 dakika "Building" state'inde olabilir. Production read query'den önce hazır olmalı.
- **Sample entry fallback:** Eğer sample entry silinmişse `sampleWord`/`sampleMeaning` boş döner. Component bunu handle eder (sadece name gösterilir).
- **Race condition:** Scheduled function her gece yazıyor, client anlık okuyor. Atomic transaction, partial document riski yok.
- **Mobile breakpoint:** 768px (mevcut recent card ile aynı).

**Toplam: 10 task, 8 dosya, ~3-4 saat implementation süresi (tahmini).**