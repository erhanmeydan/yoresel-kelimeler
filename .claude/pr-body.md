<!--
Merhaba! Katkın için teşekkürler 🇹🇷
Bu şablonu doldurman review sürecini hızlandırır.
Sorular için: https://github.com/erhanmeydan/yoresel-kelimeler/discussions
-->

## Ne değişti?

`/moderation` sayfasının "Yetkisiz. Giriş yapın." hatasının kök nedenini giderir ve bunu gerçek bir headless browser testi ile doğrular.

**Kök neden:** PR #11 ile eklenen `setPersistence(browserLocalPersistence)` sonrası Firebase Auth, sayfa yenilemelerinde oturumu **asenkron** olarak geri yükler. Header bileşeni `observeAuth()` kullandığı için doğru çalışır; ModerationPage (ve diğer sayfalar) ise `auth.currentUser`'ı senkron okuduğu için yarışı kaybeder ve `null` yakalar — bu da "Yetkisiz" mesajına yol açar.

**Neden önceki 5 PR işe yaramadı:** Hepsi ModerationPage içinde asenkron bekleme ekledi, polling ekledi veya `/contribute`'e yönlendirdi. Ama `/contribute` (EntryForm.ts) de aynı senkron `auth.currentUser` kontrolünü yapıyor, dolayısıyla aynı bug orada da ortaya çıkıyor.

**Çözüm:** `src/services/auth.service.ts`'e merkezi `ensureAuthReady(auth)` helper'ı eklendi. `auth.currentUser` zaten doluysa senkron çözer (SPA içi sıcak navigasyon); aksi halde `onAuthStateChanged`'e tek seferlik abone olur, o abonelik anında mevcut (geri yüklenmiş) kullanıcıyla fire eder. `ModerationPage` artık bu helper'ı `await` ediyor ve yönlendirme yapmıyor.

## İlgili issue

Yok (kullanıcı tarafından doğrudan rapor edildi)

## Tip

- [x] 🐛 Bug fix (`fix:`)
- [x] 🧪 Test (`test:`)

## Nasıl test edilir?

1. Yeni branch'i çek
2. `npm install`
3. `npm run build:web`
4. `npx vite preview --port 5173 &`
5. `npm run test:moderation:setup` (gerçek projede `test-mod@yoresel-kelimeler.test` admin kullanıcısı oluşturur)
6. Şu komutu çalıştır:
   ```bash
   TEST_MOD_EMAIL=test-mod@yoresel-kelimeler.test \
   TEST_MOD_PASSWORD='TestModPass123!' \
   MOD_TEST_URL=http://localhost:5173 \
   npm run test:moderation
   ```

Beklenen sonuç: "ALL ASSERTIONS PASSED" + `screenshots/moderation-final-success.png`'de "Moderasyon Paneli" başlığı, 4 tab (Raporlar, Yorumlar, Kullanıcılar, İstatistikler) ve 3 gerçek yorum.

Bu PR'daki fix olmadan aynı test `heading text: null` ve "FAIL" ile sonuçlanır — kanıt `screenshots/moderation-wrong-heading.png` ve ekran görüntüsünde görülen "Katkıda bulunmak için giriş yapmalısınız." hatası.

## Ekran görüntüsü / video (UI değişikliği ise)

`screenshots/moderation-final-success.png` — fix sonrası: Moderasyon Paneli + 4 tab + 3 yorum.

`screenshots/moderation-wrong-heading.png` — fix öncesi (eski kod): header'da kullanıcı görünür, ama `/moderation` `/contribute`'e yönlendirilip "Katkıda bulunmak için giriş yapmalısınız." gösteriyor.

## Checklist

- [x] `npm run typecheck` temiz geçiyor
- [x] `npm run build` başarılı
- [x] Yeni feature/fix için **unit/integration test** eklendi (`scripts/test-moderation-headless.mjs` + `scripts/create-test-admin.mjs`)
- [x] `git status` ile `.env.local` veya `service-account.json` eklenmediğini doğruladım (ikisi de `.gitignore`'da)
- [x] Commit mesajları [conventional commits](CONTRIBUTING.md#-conventional-commits) formatında
- [x] Branch stratejisine uygun (`fix/*`)
- [x] Hedef branch doğru (feature/fix PR'ları → `develop`)

## Reviewer notları

- **Tasarım kararı:** Yardımcıyı (`ensureAuthReady`) `auth.service.ts`'e koydum, çünkü Firebase Auth state'le ilgili tek doğru kaynak. İleride `ProfilePage.ts` ve `EntryForm.ts`'i de bu helper'ı kullanmaya geçirmek mantıklı (out of scope, follow-up).
- **Trade-off:** Test (`test-moderation-headless.mjs`) gerçek Firebase projesine karşı çalışıyor (emulator değil), çünkü PR #11'in Firestore kurallarını ve persistence davranışını uçtan uca doğrulamak istedim. CI'da çalıştırmak için repo'ya `TEST_MOD_EMAIL` / `TEST_MOD_PASSWORD` secret'ları eklemek gerekir (bu PR'da yapılmadı — local doğrulama yeterli). Emulator tabanlı test ileride ayrı bir PR olabilir.
- **Puppeteer bağımlılığı:** `puppeteer@^25.2.1` `devDependencies`'e eklendi. İlk kurulumda Chrome for Testing (~150MB) indiriyor. CI'da istenmezse skip edilebilir.
- **Screenshots ve .test-admin.json:** `.gitignore`'a eklendi, repo'ya sızmıyor.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
