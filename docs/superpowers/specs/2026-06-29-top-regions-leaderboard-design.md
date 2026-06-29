# Top Regions Leaderboard — Tasarım Spec

**Tarih:** 2026-06-29
**Durum:** Onaylandı (kullanıcı onayı alındı)
**Kapsam:** Anasayfaya "Bu Hafta En Aktif 10 İl" bölümü eklenmesi
**Bağlı spec:** `2026-06-28-yoresel-kelimeler-design.md`

---

## 1. Amaç ve Bağlam

Anasayfadaki "Son Eklenenler" bölümünün altına, son 7 günde en çok katkıda bulunan 10 ilin sıralandığı editoryal bir leaderboard bölümü eklemek. Amaç iki yönlü:

1. **Yarışma hissi:** Katkıda bulunanları kendi illeri için katkı yapmaya teşvik etmek.
2. **Kültürel vitrin:** Ziyaretçilere aktif şehirleri ve örnek sözleri göstermek.

Marka kişiliği (PRODUCT.md):
- **Sıcak · Köklü · Erişilebilir** — editoryal gazete skorboard havası
- Anti-references: "Generic SaaS dashboard görünümü", "AI-cream-trap", "Eyebrow + numbered sections silsilesi"
- **OKLCH** renkler, **serif başlık + sans body**, semantic HTML

### Başarı Kriterleri

- 1 ay içinde ilden en az 1 katkı yapan şehir sayısı 20+ (şu an: 7)
- Bölüm LCP < 200ms (snapshot read, küçük veri)
- Snapshot hesaplama süresi < 30s (scheduled function)
- Tıklama ile haritada ili seçme: 1 etkileşimde başarı
- A11y: klavye navigasyonu, screen reader desteği, focus görünür

---

## 2. Kapsam Dışı (YAGNI)

- Kullanıcı bazında (kişisel) leaderboard — sadece şehir bazında
- Sıralama geçmişi (snapshot'lar arası karşılaştırma)
- Ödül/rozet sistemi
- Sosyal paylaşım (Twitter, vb.)
- Aylık/3 aylık sıralama — sadece haftalık
- Snapshot refresh sırasıgösterge (örn. "güncellendi 5 dk önce") — sessizce logla
- Tüm zamanlar sıralaması — sadece 7 gün
- Mini harita görselleştirmesi

---

## 3. Teknoloji Yığını (mevcut)

| Katman | Tercih | Kullanım |
|---|---|---|
| Frontend | Vanilla TS + Vite | Yeni component, service |
| Backend | Firebase Functions (Node 20) | Yeni scheduled function |
| Veritabanı | Firestore | Yeni collection: `regionStats/weekly/{regionId}` |
| Stil | Sade CSS + CSS değişkenleri | `.top-regions-*` class'ları |
| Test | Vitest | Service + component + scheduled function |

---

## 4. Mimari

```
[Cloud Scheduler]  →  [Scheduled Function]  →  [Firestore]
   (her 24 saat)         updateWeeklyStats         regionStats/
                                                  weekly/{regionId}
                                                         ↓ (read)
                                            [HomePage]
                                                         ↓
                                            [renderTopRegionsSection]
                                                         ↓
                                            DOM: editoryal sıralama + bar
                                                         ↓
                                            Tıkla → handleRegionClick
                                                       ↓
                                            Harita highlight + scroll
```

### Akış

1. **Scheduled function (her 24 saat, gece 03:00 Istanbul saati):**
   - Tüm 81 region'ı oku
   - Her region için son 7 gündeki `status='active'` entry'leri sorgula
   - `likeCount DESC, createdAt DESC` ile sırala, ilk 1'i "sample" olarak seç
   - `regionStats/weekly/{regionId}` doc'una yaz (overwrite)

2. **HomePage mount:**
   - `Promise.all` ile `listRegions`, `listTopRegionsByWeeklyEntries`, `listRecentEntries` paralel çağrılır
   - Top regions bölümü "Son Eklenenler"in altına render edilir

3. **Kullanıcı tıklaması:**
   - `<button>` row'a tıklanır → `handleRegionClick(region)` çağrılır
   - Sayfa yumuşak scroll yukarı (`map-section` viewport'a)
   - Map highlight animasyonu tetiklenir

---

## 5. Veri Modeli

### Yeni Collection

**Path:** `regionStats/weekly/{regionId}`

```typescript
interface RegionWeeklyStat {
  regionId: string;          // docId ile aynı: "konya", "istanbul"...
  regionName: string;        // "Konya", "İstanbul"
  entryCount: number;        // son 7 gündeki aktif entry sayısı
  sampleEntryId: string;     // vitrin için en beğenilen 1 entry id
  sampleWord: string;        //   - kelime/deyim
  sampleMeaning: string;     //   - kısa anlam (max 80 char)
  updatedAt: Timestamp;      // ne zaman hesaplandı
}
```

**Index:** Yeni composite index gerekmez (docId `regionId` zaten unique).

**Okuma query:**
```typescript
const q = query(
  collection(db, 'regionStats/weekly'),
  orderBy('entryCount', 'desc'),
  limit(10)
);
```

Bu query yeni index gerektirir (`entryCount DESC` için):

```json
{
  "collectionGroup": "regionStats/weekly",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "entryCount", "order": "DESCENDING" }
  ]
}
```

### Mevcut Modeller (değişiklik yok)

- `Region`, `Entry` — mevcut, dokunulmuyor

---

## 6. Bileşenler

### Yeni Scheduled Function

**Path:** `functions/src/updateWeeklyStats.ts`

```typescript
export const updateWeeklyStats = functions.pubsub
  .schedule('0 3 * * *')  // Her gün 03:00 (Istanbul)
  .timeZone('Europe/Istanbul')
  .onRun(async (context) => {
    // 1. regions koleksiyonunu oku
    // 2. 7 günden eski timestamp hesapla
    // 3. Her region için:
    //    a. Entry count (aggregation)
    //    b. Sample entry (likeCount desc, createdAt desc, limit 1)
    //    c. regionStats/weekly/{regionId} doc'una yaz (set, merge: false)
    // 4. Hata logla, bir sonraki region'a devam et
  });
```

**Retry:** Cloud Scheduler otomatik (24 saat sonra tekrar).

**Index requirements:**
- `entries`: `regionId ==, status ==, createdAt >=, likeCount desc, createdAt desc` — mevcut index'lerden biri (`status ASC, likeCount DESC`) yeterli, ek index gerekebilir kontrol edilir
- `regionStats/weekly`: yeni index yukarıda tanımlı

### Yeni Service Function

**Path:** `src/services/regions.service.ts` (mevcuda ekle)

```typescript
export async function listTopRegionsByWeeklyEntries(
  db: Firestore,
  max = 10
): Promise<ServiceResult<RegionWeeklyStat[]>>;
```

**Davranış:**
- `regionStats/weekly` collection'ı `entryCount DESC` ile oku, `limit(max)`
- Sample entry id yanlış/silinmişse sample alanlarını boş döndür
- Hata durumunda `ServiceResult.ok = false` döndür

### Yeni Component Function

**Path:** `src/pages/HomePage.ts` (mevcuda ekle)

```typescript
async function renderTopRegionsSection(
  slot: HTMLElement,
  regionNameById: Map<string, string>,
): Promise<void>;

function renderTopRegionRow(
  stat: RegionWeeklyStat,
  maxCount: number,
): HTMLElement;
```

**Davranış:**
- Section'ı "Son Eklenenler" altına ekle
- 10 row render et (editorial layout)
- Empty state ve error handling aşağıda
- Row tıklaması `handleRegionClick`'i çağırır

### CSS

**Path:** `src/styles/components/home.css` (mevcuda ekle)

Yeni class'lar: `.top-regions-section`, `.top-regions-heading`, `.top-regions-subheading`, `.top-regions-list`, `.top-region-row`, `.top-region-rank`, `.top-region-info`, `.top-region-name`, `.top-region-sample`, `.top-region-stat`, `.top-region-bar`, `.top-region-bar-fill`, `.top-region-count`, `.top-regions-empty`.

Tasarım detayları:
- Mevcut design token'ları kullan (`--color-primary`, `--font-display`, vb.)
- Bar 4px yükseklik, primary fill
- Mobile (< 768px): bar gizle, sample gizle

### HomePage Entegrasyonu

```typescript
// HomePage.ts mevcut renderHomePage fonksiyonuna ekle:
const recentSlot = container.querySelector<HTMLElement>('#recent-slot')!;
const topRegionsSlot = document.createElement('section');
topRegionsSlot.className = 'top-regions-section';
topRegionsSlot.id = 'top-regions-slot';
recentSlot.after(topRegionsSlot);

void renderTopRegionsSection(topRegionsSlot, regionNameById);
```

---

## 7. UI/UX

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Bu Hafta En Aktif 10 İl                                        │
│  Son 7 günde en çok katkıda bulunan iller                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  01  Konya                       ━━━━━━━━━━━━━━━━━━━  47 söz    │
│      "göynük" — şenlik, toplantı                              │
│                                                                 │
│  02  İstanbul                    ━━━━━━━━━━━━━━━━  42 söz        │
│      "papara" — küçük bohça                                    │
│                                                                 │
│  ...                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Görsel Detaylar

- **Rank** (01–10): display font, italic, large, muted color
- **Şehir adı**: display font, semibold, primary text
- **Sample söz**: body font, italic, muted, 1 satır truncate (max-width)
- **Bar**: 4px yükseklik, primary fill, 600ms animasyonla genişle
- **Count**: tabular-nums, sağa yaslı, semibold
- **Hover**: background subtle değişim (surface-2)

### Bar Genişlik Hesaplama

```typescript
const maxCount = stats[0]?.entryCount ?? 1;
// her row için: barFill.style.width = `${(stat.entryCount / maxCount) * 100}%`
```

### Etkileşim

- Tıklama → `handleRegionClick(region)`
- Scroll yumuşak: `window.scrollTo({ top: mapSection.offsetTop, behavior: 'smooth' })`
- Reduced motion: instant scroll

### Mobile (< 768px)

- Bar gizli
- Sample gizli
- Sadece: rank + şehir adı + count

### Erişilebilirlik

- Row: `<button>` elementi (semantic)
- `aria-label`: `"Konya, 47 söz. Haritada görmek için tıklayın"`
- Focus visible: mevcut focus ring ile tutarlı
- Klavye: Tab ile gezilebilir, Enter/Space ile aktif

---

## 8. Edge Cases & Error Handling

### Boş Veri (snapshot henüz hesaplanmamış)

```typescript
if (result.data.length === 0 || result.data.every(r => r.entryCount === 0)) {
  slot.innerHTML = `
    <div class="top-regions-empty">
      <p>Bu hafta henüz kimse katkıda bulunmadı. İlk siz olun!</p>
      <a class="btn btn-primary" href="/contribute">Katkıda bulun</a>
    </div>
  `;
  return;
}
```

### Firestore Hatası

```typescript
if (!result.ok) {
  console.warn('[top-regions]', result.error.code, result.error.message);
  slot.remove(); // Recent pattern'i: sessizce gizle
  return;
}
```

### Sample Entry Silinmiş

Service function'da kontrol:
```typescript
if (sampleDoc.exists) {
  return { sampleWord: sampleDoc.data().word, sampleMeaning: ... };
} else {
  return { sampleWord: '', sampleMeaning: '' }; // fallback
}
```

UI'da: sample alanları boşsa sadece şehir adı + count göster.

### Scheduled Function Hatası

- `functions.logger.error` ile logla
- Bir sonraki region'a devam et (partial failure tolere)
- 24 saat sonra tekrar dene

### Race Condition

Firestore transaction'ları atomic. Partial document yazılmaz.

---

## 9. Performance

### Client (HomePage)

- `regionStats/weekly` read: 10 doc × ~200 byte = ~2KB. Hızlı.
- `listRegions` zaten cache'lenebilir (mevcut pattern)
- 3 query paralel (`Promise.all`): toplam süre = en yavaş tek query

### Backend (Scheduled Function)

- 81 region × 2 query (count + sample) = 162 read
- Spark plan limitleri içinde (50K read/gün free)
- Çalışma süresi: ~10-20s tahmini

### Loading State

- 3 satır skeleton placeholder (bar + rank + name + count)
- İçerik gelince fade-in (200ms)
- Skeleton `<div class="top-region-row top-region-skeleton">`

---

## 10. Testing Stratejisi

### Unit Tests

**`src/services/regions.service.ts`** (vitest + @firebase/rules-unit-testing):

```typescript
describe('listTopRegionsByWeeklyEntries', () => {
  it('returns top N regions sorted by entryCount desc');
  it('returns empty array if no stats exist');
  it('handles missing sample entry gracefully');
  it('returns error ServiceResult on Firestore failure');
});
```

### Component Tests

**`src/pages/HomePage.ts`** (vitest + jsdom):

```typescript
describe('renderTopRegionsSection', () => {
  it('renders 10 rows with correct hierarchy');
  it('renders empty state when data is empty');
  it('removes section on error');
  it('sets aria-labels correctly');
  it('handles sample-less regions gracefully');
});
```

### Function Tests

**`functions/src/updateWeeklyStats.ts`** (firebase-functions-test):

```typescript
describe('updateWeeklyStats', () => {
  it('queries entries from last 7 days per region');
  it('writes to regionStats/weekly/{regionId}');
  it('handles regions with no entries (count=0)');
  it('selects sample by likeCount desc');
  it('skips regions with deleted references');
});
```

### Manuel Smoke Test

```bash
# 1. Local function emülatörde tetikle
firebase emulators:start --only functions
# Trigger updateWeeklyStats manually

# 2. Firestore emulator'da regionStats/weekly kontrolü
# http://localhost:4000/firestore

# 3. Production build + local serve
npm run build && npm run preview

# 4. HomePage'i aç, bölüm görünüyor mu kontrol et
```

---

## 11. Migration & Deploy

### Sıralı Deploy

1. **PR 1 (Backend):**
   - `firestore.indexes.json` güncelle (yeni index)
   - `functions/src/updateWeeklyStats.ts` ekle
   - `functions/src/index.ts` export et
   - Deploy: `firebase deploy --only functions,firestore:indexes`

2. **PR 2 (Frontend):**
   - Service function ekle
   - Component function ekle
   - CSS ekle
   - HomePage entegrasyonu
   - Tests yaz
   - PR → merge → CI auto-deploy

### İlk Tetikleme

Scheduled function 03:00'te çalışır. İlk deploy sonrası:
- **Seçenek A:** Manuel tetikle (Firebase Console → Functions → updateWeeklyStats → Test)
- **Seçenek B:** Bekle, frontend deploy edilene kadar boş state gösterilir

**Karar:** PR 1 merge → 5 dakika bekle → manuel tetikle (boş snapshot olsun, frontend boş state gösterir) → PR 2 merge → canlıda data gelir.

### Rollback

- Function: `firebase functions:delete updateWeeklyStats`
- Index: `firestore.indexes.json`'dan kaldır
- Frontend: revert PR

---

## 12. Açık Sorular

- ❓ Sample için "en beğenilen" mi yoksa "en yeni" mi olsun? → **En beğenilen** (`likeCount desc, createdAt desc`)
- ❓ Snapshot günde kaç kez güncellensin? → **1 kez** (03:00). Yarışma için yeterli.
- ❓ Boş state mesajında CTA hangisi olsun? → **"/contribute"** (mevcut sayfa)
- ❓ Bar animasyonu sırasında her row'u sırayla mı göster? → **Hepsi aynı anda** (paralel)

---

## 13. Definition of Done

- [ ] `updateWeeklyStats` function deploy edildi, çalıştığı doğrulandı
- [ ] `regionStats/weekly` collection'da 81 doc oluştu
- [ ] Yeni Firestore index deploy edildi
- [ ] `listTopRegionsByWeeklyEntries` service testleri geçti
- [ ] `renderTopRegionsSection` component testleri geçti
- [ ] HomePage'te bölüm görünüyor (10 row + bar + sample)
- [ ] Tıklama haritayı yönlendiriyor + scroll ediyor
- [ ] Mobile responsive (bar/sample gizli)
- [ ] Empty state çalışıyor
- [ ] A11y: klavye navigasyonu, screen reader label
- [ ] Lighthouse Performance ≥ 90
- [ ] CI/CD: PR → merge → auto-deploy

---

**Onaylayan:** Erhan Meydan
**Tarih:** 2026-06-29
**Sonraki adım:** Implementation plan (writing-plans skill)