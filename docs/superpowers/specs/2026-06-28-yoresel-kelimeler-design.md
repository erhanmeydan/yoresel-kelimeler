# Yöresel Kelime ve Deyim Haritası — Tasarım Spec

**Tarih:** 2026-06-28
**Durum:** Onaylandı (kullanıcı onayı alındı)
**Kapsam:** MVP + polish + deploy

---

## 1. Amaç ve Bağlam

Türkiye'nin 81 iline ait yöresel kelimeleri, deyimleri ve atasözlerini; harita üzerinde, topluluk katkısıyla büyüyen bir kültürel arşiv olarak sunmak. Her kayıt; kelime/deyim, anlam, örnek cümle, il ve katkıda bulunan bilgisini içerir. Amaç; dilsel çeşitliliği belgeleyip gelecek nesillere aktarmak.

### Hedef Kitle
- Türkçe ve Türkiye kültürüne ilgi duyan yerli/diaspora kullanıcılar
- Araştırmacılar, eğitimciler, öğrenciler
- Yöresel kelime bilgisi olan herkes (katkıda bulunanlar)

### Başarı Kriterleri
- 1 ay içinde 200+ onaylı kayıt (otomatik yayın, sonra moderasyon)
- Mobilde hızlı yükleme (LCP < 2.5s)
- Lighthouse mobil performans ≥ 90
- Sıfır güvenlik ihlali (rules + Functions doğrulaması)

---

## 2. Kapsam Dışı (YAGNI)

Aşağıdakiler bilinçli olarak MVP dışı bırakıldı; geri bildirim/ölçüm sonrası değerlendirilebilir:

- Yorum ve tartışma thread'leri
- Görsel ve ses dosyası yükleme
- Çoklu dil (İngilizce vb.) arayüz
- Choropleth (renk yoğunluğu) harita katmanı
- Analytics ve hata takibi (Sentry, Firebase Analytics)
- Custom domain
- Push notification
- Beğeni dışı etkileşim (şikayet, paylaşım)
- Mobil native uygulama

---

## 3. Teknoloji Yığını

| Katman | Tercih | Versiyon |
|---|---|---|
| Build aracı | Vite | 5.x |
| Dil | TypeScript | 5.x (strict mode) |
| UI çatısı | Vanilla TS (framework yok) | — |
| Stil | Sade CSS + CSS değişkenleri | — |
| Harita | Leaflet | 1.9.x |
| Tile sağlayıcı | OpenStreetMap (Carto Voyager) | — |
| GeoJSON | Açık kaynak (il sınırları) | — |
| Backend | Firebase | — |
| Veritabanı | Cloud Firestore | — |
| Auth | Firebase Auth (e-posta/şifre) | — |
| Hosting | Firebase Hosting | — |
| Server logic | Cloud Functions (Node 20) | 4th gen |
| Emulator | Firebase Emulator Suite | — |
| Versiyon kontrol | Git + GitHub | — |

**Gerekçe özeti:** Vanilla TS, Vite ile birlikte küçük bundle (~50KB) ve hızlı yükleme sağlar. Framework gerekmez çünkü görünümler basit (harita + liste + form + modal). Leaflet, Mapbox/MapLibre yerine: API anahtarı gerektirmez, ücretsiz, Türkiye için yeterli.

---

## 4. Veri Modeli

Beş kök koleksiyon. Subcollection kullanılmaz (sorgu basitliği için).

### 4.1 `regions/{regionId}`

```
name:           string         # "Rize"
plateCode:      string         # "53"
parentRegion:   string         # "Karadeniz"
geoPoint:       GeoPoint       # centroid
bounds:         GeoPolygon     # il sınırı (opsiyonel, GeoJSON'dan)
createdAt:      Timestamp
```

Toplam 81 kayıt; seed script ile yüklenir.

### 4.2 `users/{uid}`

```
displayName:        string
email:              string
role:               "user" | "moderator" | "admin"
contributionCount:  number
approvedCount:      number
removedCount:       number
createdAt:          Timestamp
lastActiveAt:       Timestamp
```

`role` default `"user"`. Admin ataması 6.4'te açıklanmıştır.

### 4.3 `entries/{entryId}`

```
word:               string             # "paldum"
type:               "kelime" | "deyim" | "atasözü"
meaning:            string
exampleSentence:    string
regionId:           string  (→ regions/{regionId})
contributorId:      string  (→ users/{uid})
contributorName:    string             # denormalize, snapshot
status:             "active" | "removed"
removedReason:      string | null
removedBy:          string | null
removedAt:          Timestamp | null
likeCount:          number             # denormalize
searchTokens:       string[]           # küçük harf, parçalanmış
createdAt:          Timestamp
updatedAt:          Timestamp
```

**`status`:** Otomatik yayın + sonra moderasyon yaklaşımı nedeniyle yalnızca `active`/`removed`. Onay kuyruğu yok.

**`searchTokens`:** Cloud Function'da üretilir (kelime, anlam, örnek cümle → küçük harf, 2-gram prefix, tek kelime token).

### 4.4 `reports/{reportId}`

```
entryId:        string  (→ entries/{entryId})
reporterId:     string  (→ users/{uid})
reason:         string
status:         "open" | "resolved" | "dismissed"
resolvedBy:     string | null
createdAt:      Timestamp
```

### 4.5 `moderationLog/{logId}`

```
entryId:        string
moderatorId:    string
action:         "remove" | "restore" | "edit"
reason:         string
prevValue:      map | null
createdAt:      Timestamp
```

Yalnızca Cloud Functions yazabilir; istemci tarafı salt okunur (moderator için).

### 4.6 İndeksler (`firestore.indexes.json`)

- `entries`: `regionId ASC, status ASC, createdAt DESC`
- `entries`: `status ASC, likeCount DESC`
- `entries`: `status ASC, searchTokens ARRAY_CONTAINS_ANY, createdAt DESC`
- `entries`: `contributorId ASC, createdAt DESC`
- `reports`: `status ASC, createdAt DESC`

---

## 5. Modüller ve Bileşenler

Her modülün sorumluluğu tek ve net olacak şekilde sınırlar çizilmiştir.

### 5.1 `services/`
İş mantığı, Firestore/Auth API çağrıları. UI'dan bağımsız.

- **`auth.service.ts`**: register, login, logout, observeAuth, getProfile, updateProfile.
- **`entries.service.ts`**: createEntry, updateOwnEntry, deleteOwnEntry, listActiveByRegion, searchEntries, getEntry, toggleLike.
- **`regions.service.ts`**: listRegions, getRegion, getRegionByName.
- **`reports.service.ts`**: createReport, listOpenReports.
- **`moderation.service.ts`**: removeEntry, restoreEntry, listModerationLog (admin only).

### 5.2 `components/`
UI birimleri; saf DOM işlemleri veya basit template. Service'leri çağırır.

- **Header**: logo, arama çubuğu, auth butonu.
- **MapView**: Leaflet instance, marker'lar, popup yönetimi.
- **EntryCard**: tek kayıt önizleme (kelime, il, özet).
- **EntryDetail**: modal/panel ile detay görünümü + beğeni + rapor.
- **EntryForm**: katkı formu (validasyonlu).
- **SearchBar**: arama input + sonuç dropdown.
- **AuthModal**: login/register tab'lı modal.
- **ProfileMenu**: dropdown (profil, çıkış).
- **ReportButton**: rapor modal tetikleyici.

### 5.3 `pages/`
Hash routing (basit, framework'süz). Sayfa düzeyinde state.

- **HomePage**: harita + arama + bölge listesi.
- **ContributePage**: form.
- **ProfilePage**: kendi kayıtları, profil bilgisi.
- **ModerationPage**: raporlar + log + aksiyonlar (admin/moderator only).

### 5.4 `utils/`
- **`validation.ts`**: form kuralları (max 100 char kelime, max 500 char anlam vb.).
- **`sanitize.ts`**: XSS koruması (HTML escape, DOMPurify ihtiyaç halinde).
- **`search.ts`**: arama token üretimi (client tarafı preview için).
- **`geo.ts`**: Leaflet yardımcıları (icon oluşturma, popup builder).

### 5.5 `types/models.ts`
Tüm Firestore model tip tanımları. Strict TypeScript ile tip güvenliği.

---

## 6. Güvenlik

### 6.1 API Anahtarları

- Firebase web config (`apiKey`, `authDomain` vb.) public olabilir (istemci tarafı için normal). Ancak Firebase Console'da **HTTP referrer kısıtlaması** zorunlu: yalnızca `localhost:*`, `*.web.app`, `*.firebaseapp.com` ve (varsa) custom domain.
- Cloud Functions sırları (varsa) **Firebase Secret Manager** ile yönetilir.
- `.env.local` → `.gitignore` içinde. `.env.example` şablon olarak repoda.

### 6.2 Firestore Security Rules (Tam Taslak)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    function isModerator() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['moderator', 'admin'];
    }

    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isValidEntry(data) {
      return data.word is string && data.word.size() > 0 && data.word.size() <= 100
        && data.meaning is string && data.meaning.size() > 0 && data.meaning.size() <= 500
        && data.exampleSentence is string && data.exampleSentence.size() <= 500
        && data.type in ['kelime', 'deyim', 'atasözü']
        && data.regionId is string
        && data.status in ['active', 'removed'];
    }

    match /regions/{regionId} {
      allow read: if true;
      allow write: if isAdmin();   // sadece admin seed/ekleme
    }

    match /users/{uid} {
      allow read: if true;          // public profil (UI sadece güvenli alanları gösterir)
      allow create: if isOwner(uid);
      allow update: if isOwner(uid) && !('role' in request.resource.data) || isAdmin();
      allow delete: if isAdmin();
    }

    match /entries/{entryId} {
      allow read: if resource.data.status == 'active'
                   || (isSignedIn() && resource.data.contributorId == request.auth.uid)
                   || isModerator();
      allow create: if isSignedIn()
                     && isValidEntry(request.resource.data)
                     && request.resource.data.contributorId == request.auth.uid
                     && request.resource.data.status == 'active';
      allow update: if isSignedIn() &&
                     (
                       (resource.data.contributorId == request.auth.uid
                        && isValidEntry(request.resource.data)
                        && request.resource.data.contributorId == resource.data.contributorId
                        && request.resource.data.contributorId == request.auth.uid)
                       || isModerator()
                     );
      allow delete: if isModerator();
    }

    match /reports/{reportId} {
      allow create: if isSignedIn() && request.resource.data.reporterId == request.auth.uid;
      allow read: if isModerator();
      allow update, delete: if isModerator();
    }

    match /moderationLog/{logId} {
      allow read: if isModerator();
      allow write: if false;        // sadece server (Cloud Functions)
    }
  }
}
```

### 6.3 Input Validasyonu

İki katmanlı:
- **Client (`utils/validation.ts`)**: HTML5 attributes + JS doğrulama; anlık geri bildirim.
- **Server (Security Rules + Cloud Functions)**: nihai doğrulama; client bypass'a kapalı.

### 6.4 İlk Admin Atama

`ADMIN_EMAIL` ortam değişkeni (`functions/.env`) Cloud Functions'a verilir. `onUserCreate` trigger'ı şu email ile kayıt olan ilk kullanıcıya `role: "admin"` set eder. Alternatif: Firebase Console'dan manuel `users/{uid}.role = "admin"`.

### 6.5 Rate Limiting

Firestore rules ile basit yaklaşım (MVP yeterli): Kullanıcının son dakikadaki entry sayısı `users/{uid}.lastEntriesCount` ve `lastEntryResetAt` üzerinden kontrol edilir. Dakikada max 5 entry. Aşım halinde `allow create = false`.

Daha karmaşık ihtiyaç olursa Cloud Functions ile token bucket eklenir.

### 6.6 Denetim İzi

Tüm moderasyon aksiyonları `moderationLog`'a yazılır. Cloud Function içinde transaction ile yapılır: entry güncellenir + log yazılır atomik. Restore için eski değer `prevValue`'da tutulur.

---

## 7. Build Aşamaları

| # | Aşama | İçerik | Doğrulama |
|---|---|---|---|
| **0** | Hazırlık | GitHub repo, Vite+TS scaffold, Firebase projesi, CLI login, `firebase init` | `npm run dev` çalışıyor, emulator bağlantısı var |
| **1** | Temel Altyapı | Firebase config, env yönetimi, emulators, rules v0, `regions` seed | Emulator'da 81 il görünüyor |
| **2** | Harita | Leaflet + OSM, 81 il marker'ı, il tıklayınca o ilin aktif kayıtları | Harita açılıyor, ile tıklayınca liste çıkıyor |
| **3** | Auth | Login/register/logout, auth state observer, profil sayfası | Kayıt olup giriş yapılabiliyor |
| **4** | Katkı | Form, validasyon, `entries` yazma, kullanıcının kendi girdileri | Yeni girdi haritada görünüyor |
| **5** | Arama | SearchBar, `searchTokens` üreten Function, sonuç listesi | "paldum" aratınca ilgili kayıtlar çıkıyor |
| **6** | Moderasyon | Rapor butonu, moderator paneli, kaldırma/geri yükleme, log | Moderator bir kaydı kaldırınca haritadan düşüyor |
| **7** | Polish | Mobil uyum, lazy load, code split, Lighthouse 90+ | Lighthouse mobil raporu |
| **8** | Deploy | `firebase deploy` production | `*.web.app` canlı, emülatör ile birebir |

**Seed verisi zamanlaması:**
- Aşama 1 sonu: 81 il seed.
- Aşama 4 öncesi: ~80 örnek entry (her bölgeden 8-12 bilinen kelime/deyim). Manuel araştırma ile TDK ve benzer kültürel kaynaklardan derlenir; her entry için `seed@system.local` UID'sine sahip tek bir "Sistem Seed" kullanıcısı oluşturulur ve `contributorId` bu kullanıcıya işaret eder. `contributorName = "Kültürel Kaynak"`. Her kayıt `status: "active"` olarak yüklenir ve `searchTokens` Cloud Function ile üretilir. Telif notu README'de belirtilir.

---

## 8. UI/UX Genel İlkeleri

- **Türkçe arayüz.** Hiçbir İngilizce metin UI'da görünmez.
- **Mobil öncelikli.** Önce 375px genişlikte tasarla, sonra büyüt.
- **Erişilebilirlik:** Anlamlı etiketler, klavye navigasyonu, kontrast oranı ≥ 4.5:1.
- **Performans:** Lazy load (Leaflet sadece harita açıkken), code split (sayfa başına chunk).
- **Tema:** Krem + terrakotta (kültürel, sıcak). Tipografi: Playfair Display (başlık) + Inter (gövde).
- **Boş durum:** "Henüz bu bölgeden kayıt yok. İlk siz ekleyin!" gibi davetkar boş state.

---

## 9. Kabul Kriterleri (Definition of Done)

Proje tamamlandı sayılması için:

1. Tüm 9 aşama (0-8) tamamlandı.
2. Emulator'da ve production'da uçtan uca akış çalışıyor: giriş → katkı → haritada görünme → arama → moderasyon.
3. Lighthouse mobil: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
4. Firestore Security Rules test edildi (Firestore Emulator + unit test).
5. README.md'de kurulum, geliştirme, deploy adımları eksiksiz.
6. En az 1 commit her aşama için (anlamlı mesajlarla).
7. GitHub repo public veya private (kullanıcı tercihine göre).

---

## 10. Açık Sorular ve Varsayılanlar

Aşağıdaki tercihler tasarım sırasında kullanıcı tarafından onaylandı (varsayılan olarak işaretlenenler):

- A: ✓ Like butonu (minimal)
- B: ✗ Yorum
- C: ✗ Medya yükleme
- D: Marker + popup (choropleth değil)
- E: Açık kaynak GeoJSON (`github.com/ozdemirburak/il-iller` veya eşdeğeri)
- F: ✗ Çoklu dil (sadece Türkçe)
- G: Manuel admin ataması (hardcoded `ADMIN_EMAIL`)
- H: ✗ Analytics
- I: Firebase subdomain (`.web.app`)
- J: Playfair Display + Inter
- K: ✗ Sentry
- L: MVP önce, polish sonra

İleride geri bildirimle bunlardan herhangi biri eklenebilir; mimari buna izin verir.

---

## 11. Hata Yönetimi

- **Service katmanı:** Tüm Firestore/Auth çağrıları `try/catch` ile sarılır; hatalar `Error` objesi olarak döner (UI'ın işleyebileceği standart tip). Kullanıcı dostu Türkçe mesajlar service tarafından eşlenir (`auth/user-not-found` → "Bu e-postaya sahip bir hesap yok.").
- **UI katmanı:** Form hataları inline gösterilir. Network/auth hataları toast veya modal ile bildirilir. Asla ham `Error.message` UI'a sızmaz.
- **Auth yenileme:** `onAuthStateChanged` observer ile oturum süresi dolunca login'e yönlendirilir.
- **Offline:** Firestore persistent cache varsayılan açık. Offline'da oluşturulan entry'ler kuyruğa alınır, bağlantı gelince senkronize olur. Kullanıcıya "Çevrimdışı; kayıt gönderildiğinde yayınlanacak" gibi bilgi verilir.

## 12. Test Stratejisi

- **Firestore Rules:** `@firebase/rules-unit-testing` ile emulator üzerinde unit test. Her kural seti için olumlu/olumsuz senaryolar (kim neyi okuyabilir, yazabilir). Aşama 1 ve 6 sonunda zorunlu.
- **Smoke test:** Her aşama sonunda `npm run dev` ile manuel uçtan uca akış (auth → katkı → görünür → moderasyon).
- **Manuel UI testi:** Chrome DevTools mobil simülasyon + gerçek mobil cihaz (kullanıcının cihazı).
- **Lighthouse:** Aşama 7'de production build üzerinde.
- **Bir otomatik test framework'ü (Vitest/Jest) UI için eklenmez** (MVP); kritik logic Functions'a taşınır ve orada test edilebilir.

## 13. Sonraki Adım

Bu spec onaylandıktan sonra `superpowers:writing-plans` becerisi çağrılarak aşama aşama uygulama planı (implementation plan) oluşturulacak. Plan; her aşama için dosya bazlı checklist, commit mesajları, doğrulama adımları içerecek.