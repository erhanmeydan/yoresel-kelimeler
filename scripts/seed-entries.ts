import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

// Service account kimlik bilgilerini al: önce env var, yoksa service-account.json dosyasından
function loadServiceAccount(): Record<string, unknown> {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (fromEnv && fromEnv.trim().length > 0) {
    try {
      return JSON.parse(fromEnv);
    } catch (err) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON parse hatası:', err);
      process.exit(1);
    }
  }
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? resolve(__dirname, '../service-account.json');
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`${filePath} okuma hatası:`, err);
      process.exit(1);
    }
  }
  console.error('Service account bulunamadı. Şunlardan birini yapın:');
  console.error('  1) .env.local\'e FIREBASE_SERVICE_ACCOUNT_JSON ekleyin, veya');
  console.error('  2) service-account.json dosyasını proje köküne koyun, veya');
  console.error('  3) FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/file env değişkeni verin.');
  process.exit(1);
}

const serviceAccount = loadServiceAccount();
const app = initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
const db = getFirestore(app);

const SEED_USER_ID = 'seed@system.local';
const CONTRIBUTOR_NAME = 'Kültürel Kaynak';

interface SeedEntry {
  word: string;
  type: 'kelime' | 'deyim' | 'atasözü';
  meaning: string;
  exampleSentence: string;
  plateCode: string;
}

/**
 * 100 örnek entry — Türkiye'nin farklı yörelerinden kelimeler, deyimler ve atasözleri.
 * Bölge kodları (01-81) il plaka kodlarıyla eşleşir.
 */
const ENTRIES: SeedEntry[] = [
  // ─── KELİME — Karadeniz Bölgesi ─────────────────────────────────────
  { word: 'paldum', type: 'kelime', meaning: 'Ağaç kütüğü, tomruk.', exampleSentence: 'Paldumu baltayla yarıp odun yaptı.', plateCode: '53' },
  { word: 'höllük', type: 'kelime', meaning: 'Vadi, dere yatağı; çukur yer.', exampleSentence: 'Höllüğe doğru inen patikayı izledik.', plateCode: '61' },
  { word: 'çedene', type: 'kelime', meaning: 'Keçiboynuzundan yapılan, kahveye benzer sıcak içecek.', exampleSentence: 'Kış akşamları çedene içmeden uyumayız.', plateCode: '61' },
  { word: 'muhlama', type: 'kelime', meaning: 'Mısır unu, tereyağı ve peynirle yapılan sıcak Karadeniz yemeği.', exampleSentence: 'Sabahları muhlama ile kahvaltı ederiz.', plateCode: '53' },
  { word: 'lazut', type: 'kelime', meaning: 'Kestane unundan yapılan koyu çorba.', exampleSentence: 'Dağdan inenler ilk iş olarak lazut içer.', plateCode: '61' },
  { word: 'kuymak', type: 'kelime', meaning: 'Mısır ekmeği, peynir ve tereyağıyla yapılan kahvaltılık.', exampleSentence: 'Misafire kuymak ikram etmek adettendir.', plateCode: '52' },
  { word: 'kemençe', type: 'kelime', meaning: 'Karadeniz müziğinin yaylı sazı.', exampleSentence: 'Düğünde kemençe susmadı sabaha kadar.', plateCode: '61' },
  { word: 'şırop', type: 'kelime', meaning: 'Üzüm veya dut pekmezinin suyla seyreltilmiş hali.', exampleSentence: 'Yaz sıcağında buz gibi şırop içilir.', plateCode: '28' },
  { word: 'godoş', type: 'kelime', meaning: 'Yaşlı kadın (saygısız/şaka yollu kullanım).', exampleSentence: 'Mahallenin godoşu her dedikoduyu bilir.', plateCode: '52' },
  { word: 'çepni', type: 'kelime', meaning: 'Türkiye’nin çeşitli bölgelerine dağılmış bir Türkmen topluluğu; aynı zamanda yöre adı.', exampleSentence: 'Çepni köylerinde eski gelenekler hâlâ yaşar.', plateCode: '05' },

  // ─── KELİME — Ege Bölgesi ─────────────────────────────────────────
  { word: 'zeybek', type: 'kelime', meaning: 'Ege yöresine özgü halk oyunu ve bu oyunu oynayan kişi.', exampleSentence: 'Düğün zeybek oynanmadan başlamaz.', plateCode: '35' },
  { word: 'boyoz', type: 'kelime', meaning: 'İzmir\'e özgü, genellikle peynirli veya patatesli içi boş hamur işi.', exampleSentence: 'Sabahları bir boyoz, bir çay harika gider.', plateCode: '35' },
  { word: 'kumru', type: 'kelime', meaning: 'İzmir\'e özgü, sucuk, salam, peynir vb. malzemeyle yapılan sandviç.', exampleSentence: 'İzmir\'e giden herkes kumru yer.', plateCode: '35' },
  { word: 'keşkek', type: 'kelime', meaning: 'Dövülmüş buğday ve etle yapılan, düğünlerde pişirilen geleneksel yemek.', exampleSentence: 'Düğünde kazanlarda keşkek kaynar.', plateCode: '43' },
  { word: 'söğürtmesi', type: 'kelime', meaning: 'Ege meze kültüründe zeytinyağlı soğuk yemek.', exampleSentence: 'Akşam yemeğine söğürtmesi hazırladı.', plateCode: '09' },
  { word: 'çekirdeksiz üzüm', type: 'kelime', meaning: 'Manisa ve Alaşehir yöresine özgü kuru üzüm çeşidi (sultanı).', exampleSentence: 'Çekirdeksiz üzüm ihracatı önemli.', plateCode: '45' },
  { word: 'odun kebabı', type: 'kelime', meaning: 'Odun ateşinde, ağır ağır pişirilen et yemeği.', exampleSentence: 'Bodrum\'da odun kebabı yemeden dönme.', plateCode: '48' },
  { word: 'tarhana', type: 'kelime', meaning: 'Yoğurt, un ve sebzelerle yapılan, kurutulup kış için saklanan çorba hammaddesi.', exampleSentence: 'Annem her yaz kışlık tarhana yapar.', plateCode: '58' },

  // ─── KELİME — Akdeniz Bölgesi ─────────────────────────────────────
  { word: 'künefe', type: 'kelime', meaning: 'İnce kadayıf, peynir ve şerbetten yapılan sıcak tatlı.', exampleSentence: 'Hatay\'a gidenler künefe yemeden dönmez.', plateCode: '31' },
  { word: 'şalgam', type: 'kelime', meaning: 'Acılı, turpgillerden yapılan bir içecek; Adana sofrasının vazgeçilmezi.', exampleSentence: 'Adana\'da kebapla birlikte şalgam içilir.', plateCode: '01' },
  { word: 'içli köfte', type: 'kelime', meaning: 'Dışı bulgur, içi kıyma ile hazırlanan; kızartılan ya da haşlanan yemek.', exampleSentence: 'Misafirler için içli köfte hazırladı.', plateCode: '27' },
  { word: 'beyti', type: 'kelime', meaning: 'Lavaşa sarılı kıyma ve yoğurtla servis edilen kebap çeşidi.', exampleSentence: 'Beyti sarma, Adana usulü.', plateCode: '01' },
  { word: 'şırdan', type: 'kelime', meaning: 'İçi baharatlı bulgurla doldurulmuş işkembe yemeği.', exampleSentence: 'Sabah kahvaltısında şırdan yenir.', plateCode: '01' },
  { word: 'piyaz', type: 'kelime', meaning: 'Antakya usulü tahinli kuru bakla yemeği.', exampleSentence: 'Antakya usulü piyaz meşhurdur.', plateCode: '31' },
  { word: 'tantuni', type: 'kelime', meaning: 'Mersin\'e özgü, dürne sarılı küçük et parçaları.', exampleSentence: 'Mersin\'den dönerken tantuni aldık.', plateCode: '33' },

  // ─── KELİME — Güneydoğu Anadolu ────────────────────────────────────
  { word: 'çiğ köfte', type: 'kelime', meaning: 'Bulgur, isot, salça ve baharatlarla yapılan; günümüzde etsiz hazırlanan yemek.', exampleSentence: 'Akşam çiğ köfte yoğurduk.', plateCode: '63' },
  { word: 'katmer', type: 'kelime', meaning: 'İnce açılmış hamurun yağda katlanarak pişirilmesiyle yapılan yufka tatlısı.', exampleSentence: 'Gaziantep\'te kahvaltıda katmer yenir.', plateCode: '27' },
  { word: 'beyran', type: 'kelime', meaning: 'Gaziantep\'e özgü, kelle veya et suyuyla yapılan sıcak çorba.', exampleSentence: 'Soğuk sabahlarda bir kase beyran içtim.', plateCode: '27' },
  { word: 'küşleme', type: 'kelime', meaning: 'Şanlıurfa\'ya özgü ızgarada pişirilen küçük et parçaları.', exampleSentence: 'Urfa\'da küşleme yemek için saatlerce sıra beklenir.', plateCode: '63' },
  { word: 'isot', type: 'kelime', meaning: 'Şanlıurfa yöresine özgü kırmızı biberin kurutulup pul haline getirilmiş hali.', exampleSentence: 'Çiğ köftenin olmazsa olmazı isot.', plateCode: '63' },
  { word: 'Antep fıstığı', type: 'kelime', meaning: 'Gaziantep yöresinde yetişen, kendine özgü lezzetli yeşil iç fıstık.', exampleSentence: 'Baklavanın en iyisi Antep fıstığıyla yapılır.', plateCode: '27' },
  { word: 'mumbar', type: 'kelime', meaning: 'Kuzu bağırsağının kıyma ve baharatlarla doldurulmasıyla yapılan yemek.', exampleSentence: 'Kış aylarında mumbar dolması yapılır.', plateCode: '47' },

  // ─── KELİME — İç Anadolu ───────────────────────────────────────────
  { word: 'mantı', type: 'kelime', meaning: 'İçi kıymalı küçük hamur parçaları; Kayseri\'de küçük yapılır, yoğurt ve sarımsakla servis edilir.', exampleSentence: 'Pazar günü ailece mantı yaparız.', plateCode: '38' },
  { word: 'pastırma', type: 'kelime', meaning: 'Tuzlanıp kurutulmuş, çemenle kaplanmış et yiyeceği.', exampleSentence: 'Kışlık pastırma için et hazırlandı.', plateCode: '38' },
  { word: 'höşmerim', type: 'kelime', meaning: 'Sivas\'a özgü taze peynir, un ve şekerle yapılan tatlı.', exampleSentence: 'Misafire höşmerim ikram ettik.', plateCode: '58' },
  { word: 'madımak', type: 'kelime', meaning: 'Sivas yöresine özgü yabani ot; genellikle yumurtalı ya da yoğurtlu pişirilir.', exampleSentence: 'Bahar geldi, madımak toplama zamanı.', plateCode: '58' },
  { word: 'pekmez', type: 'kelime', meaning: 'Üzüm, dut veya başka meyvelerin kaynatılarak koyulaştırılmasıyla elde edilen tatlı.', exampleSentence: 'Sabahları pekmez yiyoruz.', plateCode: '42' },
  { word: 'çerkez', type: 'kelime', meaning: 'Çerkez halkı ve bu halka ait mutfak kültürü.', exampleSentence: 'Çerkez tavuğu meşhur bir yemektir.', plateCode: '39' },
  { word: 'tahin', type: 'kelime', meaning: 'Susamın ezilmesiyle elde edilen koyu, yağlı hamur.', exampleSentence: 'Tahin-pekmez kış aylarının vazgeçilmezidir.', plateCode: '07' },

  // ─── KELİME — Doğu Anadolu ─────────────────────────────────────────
  { word: 'gravyer', type: 'kelime', meaning: 'Kars yöresine özgü, inek sütünden yapılan sarı peynir.', exampleSentence: 'Kars gravyeri sofradan eksik olmaz.', plateCode: '36' },
  { word: 'cağ kebabı', type: 'kelime', meaning: 'Erzurum\'a özgü, yatay şişte odun ateşinde pişirilen kebap.', exampleSentence: 'Erzurum\'un cağ kebabı bir başka lezzet.', plateCode: '25' },
  { word: 'kete', type: 'kelime', meaning: 'Doğu Anadolu\'da içine peynir veya kıyma konularak yapılan hamur işi.', exampleSentence: 'Çay yanında kete yedik.', plateCode: '25' },
  { word: 'murt', type: 'kelime', meaning: 'Doğu Anadolu\'da çorba ve yemeklere eklenen kurutulmuş et.', exampleSentence: 'Kış için murt hazırladılar.', plateCode: '24' },
  { word: 'abugannuş', type: 'kelime', meaning: 'Köz patlıcan, biber ve sarımsakla yapılan meze.', exampleSentence: 'Mardin sofrasının vazgeçilmez mezesi abugannuş.', plateCode: '47' },

  // ─── KELİME — Marmara & Trakya ─────────────────────────────────────
  { word: 'çıtır börek', type: 'kelime', meaning: 'Tekirdağ\'a özgü, yağda kızartılan ince hamurlu börek.', exampleSentence: 'Tekirdağ çıtır böreği meşhurdur.', plateCode: '59' },
  { word: 'hardaliye', type: 'kelime', meaning: 'Hardal ile yapılan hafif alkollü içecek; Trakya\'ya özgü.', exampleSentence: 'Trakya düğünlerinin içkisi hardaliye.', plateCode: '22' },
  { word: 'Rumeli', type: 'kelime', meaning: 'Osmanlı döneminde Avrupa\'daki toprakları tanımlayan ad; günümüzde Trakya için de kullanılır.', exampleSentence: 'Rumeli türküleri kültürümüzün parçasıdır.', plateCode: '39' },
  { word: 'fasulye', type: 'kelime', meaning: 'Baklagillerden sebze; Türk mutfağının temel taşı.', exampleSentence: 'Kuru fasulye pilav bizim aşkımızdır.', plateCode: '26' },
  { word: 'ıspanak', type: 'kelime', meaning: 'Yaprakları yemek olarak tüketilen sebze.', exampleSentence: 'Ispanak yemeği yanına yoğurt iyi gider.', plateCode: '42' },

  // ─── YÖRESEL KELİMELER (gerçek ağız özellikleri) ──────────────────
  { word: 'güzel hava', type: 'kelime', meaning: 'Karadeniz\'de \"hoşça kal\" anlamında vedalaşma ifadesi.', exampleSentence: 'Güzel hava, yarın görüşürüz!', plateCode: '52' },
  { word: 'çiçek', type: 'kelime', meaning: 'Bazı yörelerde \"kız, gelin\" anlamında sevgi sözcüğü.', exampleSentence: 'Aman çiçeğim, ne güzel büyümüşsün.', plateCode: '14' },
  { word: 'abacı', type: 'kelime', meaning: 'Eskiden kumaş satan esnaf; abacılık önemli bir meslek.', exampleSentence: 'Mahalledeki abacı dükkânı çok eskiydi.', plateCode: '14' },
  { word: 'çınar', type: 'kelime', meaning: 'Büyük, uzun ömürlü ağaç; Anadolu köylerinin simgesi.', exampleSentence: 'Meydanın ortasındaki çınar 300 yaşında.', plateCode: '06' },
  { word: 'gurbet', type: 'kelime', meaning: 'Yabancı diyar, başka şehir.', exampleSentence: 'Gurbette olan herkes vatanını özler.', plateCode: '38' },
  { word: 'silaya dönmek', type: 'kelime', meaning: 'Memleketine, doğduğu yere geri dönmek.', exampleSentence: 'Bayramda sılaya döndük.', plateCode: '06' },
  { word: 'kavun', type: 'kelime', meaning: 'Yaz aylarında tüketilen iri, sulu meyve.', exampleSentence: 'Kavun soğuk olarak yenir.', plateCode: '32' },
  { word: 'nar', type: 'kelime', meaning: 'Kırmızı tanecikli meyve; özellikle Güneydoğu Anadolu ve Akdeniz\'de yetişir.', exampleSentence: 'Nar suyu kahvaltılarda içilir.', plateCode: '63' },
  { word: 'biber', type: 'kelime', meaning: 'Türkiye mutfağının her yerinde kullanılan sebze; yöreye göre acı veya tatlı çeşitleri var.', exampleSentence: 'Biber dolması sevdiğim yemeklerden.', plateCode: '27' },
  { word: 'kayısı', type: 'kelime', meaning: 'Malatya\'ya özgü meyve; kuru kayısı ihracatı önemlidir.', exampleSentence: 'Malatya kayısısı dünyaca ünlüdür.', plateCode: '44' },

  // ─── DEYİMLER ─────────────────────────────────────────────────────
  { word: 'Çam sakızı, çoban armağanı', type: 'deyim', meaning: 'Değersiz ama gönülden gelen küçük hediye.', exampleSentence: 'Bir fincan kahve getirdi, çam sakızı çoban armağanı.', plateCode: '06' },
  { word: 'Dut yaprağı', type: 'deyim', meaning: 'Boş, anlamsız söz; asılsız dedikodu.', exampleSentence: 'Onun söyledikleri dut yaprağı.', plateCode: '34' },
  { word: 'Çıtı çıtı', type: 'deyim', meaning: 'Önemsiz, dedikoduya dayalı konuşma.', exampleSentence: 'Komşular çıtı çıtıyla vakit öldürüyordu.', plateCode: '06' },
  { word: 'Kafayı yemek', type: 'deyim', meaning: 'Çok sinirlenmek veya delirmek.', exampleSentence: 'Sınav sonuçlarını görünce kafayı yedi.', plateCode: '34' },
  { word: 'Ağzı açık ayran budalası', type: 'deyim', meaning: 'Şaşkın, ne yapacağını bilemeyen kimse.', exampleSentence: 'O kadar ağzı açık ayran budalası ki hâlâ haberi yok.', plateCode: '06' },
  { word: 'Burnundan solumak', type: 'deyim', meaning: 'Aşırı öfkeli olmak.', exampleSentence: 'Patron burnundan soluyordu.', plateCode: '34' },
  { word: 'Etekleri zil çalmak', type: 'deyim', meaning: 'Aşırı sevinçli olmak.', exampleSentence: 'İkramiyeyi duyunca etekleri zil çaldı.', plateCode: '42' },
  { word: 'Gönlü kalmak', type: 'deyim', meaning: 'Alınganlık göstermek, küskün olmak.', exampleSentence: 'Söz vermiştik ama gidemedik, gönlü kaldı.', plateCode: '06' },
  { word: 'Hamsi gibi kızarıp somurtmak', type: 'deyim', meaning: 'Utanıp kızarmak, sessizleşmek.', exampleSentence: 'Yalanı yakalanınca hamsi gibi kızardı.', plateCode: '53' },
  { word: 'İçi dışı bir', type: 'deyim', meaning: 'İçi ve dışı aynı; samimi, dürüst.', exampleSentence: 'O içi dışı bir adamdır, sözünün eridir.', plateCode: '06' },
  { word: 'Kabak tadı vermek', type: 'deyim', meaning: 'Sıkıcı hale gelmek, bıktırmak.', exampleSentence: 'Bu konu artık kabak tadı verdi.', plateCode: '34' },
  { word: 'Laf arasında', type: 'deyim', meaning: 'Söyleşi sırasında, sırası gelmişken.', exampleSentence: 'Laf arasında İstanbul\'a taşınacağını söyledi.', plateCode: '34' },
  { word: 'Ocağına düştü', type: 'deyim', meaning: 'Bakımı, sorumluluğu ona kaldı.', exampleSentence: 'Çocuk büyütmek bütün iş ocağıma düştü.', plateCode: '06' },
  { word: 'Paldımı attı', type: 'deyim', meaning: 'Çok öfkelendi, küplere bindi.', exampleSentence: 'Patron paldımı attı, herkes sustu.', plateCode: '53' },
  { word: 'Saçını süpürge etmek', type: 'deyim', meaning: 'Çok çalışıp didinmek.', exampleSentence: 'Çocukları için saçını süpürge etti.', plateCode: '06' },
  { word: 'Şapka çıkarmak', type: 'deyim', meaning: 'Saygı duymak, takdir etmek.', exampleSentence: 'Başarısı karşısında şapka çıkarmamak elde değil.', plateCode: '34' },
  { word: 'Taş koymak', type: 'deyim', meaning: 'Engel olmak, zorlaştırmak.', exampleSentence: 'İşlerini kolaylaştıracağına taş koyuyor.', plateCode: '06' },
  { word: 'Tuzluya mal olmak', type: 'deyim', meaning: 'Çok pahalıya, sıkıntıya mal olmak.', exampleSentence: 'O kaza bize tuzluya mal oldu.', plateCode: '06' },
  { word: 'Uyku tutmamak', type: 'deyim', meaning: 'Uyuyamamak, uykusuz kalmak.', exampleSentence: 'Heyecandan uyku tutmadı.', plateCode: '34' },
  { word: 'Yanına kalmak', type: 'deyim', meaning: 'Artmak, fazla gelmek.', exampleSentence: 'Yemekten bize yanına kaldı.', plateCode: '06' },
  { word: 'Zıp diye', type: 'deyim', meaning: 'Birdenbire, aniden.', exampleSentence: 'Zıp diye karşıma çıkıverdi.', plateCode: '34' },
  { word: 'Aklı başına gelmek', type: 'deyim', meaning: 'Doğruyu görmek, kendine gelmek.', exampleSentence: 'Sonunda aklı başına geldi.', plateCode: '06' },
  { word: 'Çam sakızı', type: 'deyim', meaning: 'Çiğnenen reçineli sakız; ayrıca değersiz hediye anlamında da kullanılır.', exampleSentence: 'Çocuk çam sakızı çiğniyordu.', plateCode: '35' },
  { word: 'Başı dumanlı', type: 'deyim', meaning: 'Kafası karışık, ne yapacağını bilemeyen.', exampleSentence: 'Sabah başı dumanlıydı, çay içmesi lazımdı.', plateCode: '06' },
  { word: 'Çorbada tuzu olsun', type: 'deyim', meaning: 'Bir işte emeği olsun.', exampleSentence: 'Onun da çorbada tuzu olsun.', plateCode: '06' },

  // ─── ATASÖZLERİ ──────────────────────────────────────────────────
  { word: 'Damlaya damlaya göl olur.', type: 'atasözü', meaning: 'Küçük birikimler zamanla büyük sonuçlar verir.', exampleSentence: 'Her ay beş lira biriktirdi, damlaya damlaya göl olur.', plateCode: '06' },
  { word: 'Ak akçe kara gün içindir.', type: 'atasözü', meaning: 'Biriktirilen para, zor günler için saklanmalıdır.', exampleSentence: 'Akraba ak akçe kara gün içindir, demedi mi?', plateCode: '06' },
  { word: 'İşleyen demir pas tutmaz.', type: 'atasözü', meaning: 'Çalışan, üreten kimse güçlü kalır.', exampleSentence: 'İşleyen demir pas tutmaz, dedelerimiz boşuna söylememiş.', plateCode: '06' },
  { word: 'Tencere yuvarlanmış, kapağını bulmuş.', type: 'atasözü', meaning: 'Herkes kendine uygun birini bulur.', exampleSentence: 'Onlar da tencere yuvarlanmış, kapağını bulmuş.', plateCode: '06' },
  { word: 'Sakla samanı, gelir zamanı.', type: 'atasözü', meaning: 'Bugün gereksiz görünen şey, ileride lazım olabilir.', exampleSentence: 'Eski eşyaları atma, sakla samanı gelir zamanı.', plateCode: '06' },
  { word: 'Dost kara günde belli olur.', type: 'atasözü', meaning: 'Gerçek dost zor günde yanında olan insandır.', exampleSentence: 'Dost kara günde belli olur, dedem haklıymış.', plateCode: '06' },
  { word: 'Akıl yaşta değil, baştadır.', type: 'atasözü', meaning: 'Bilgelik yaşla değil, kafayla ilgilidir.', exampleSentence: 'Akıl yaşta değil baştadır, o çocuk herkesten akıllı.', plateCode: '06' },
  { word: 'Her yiğidin bir yoğurt yiyişi vardır.', type: 'atasözü', meaning: 'Herkesin bir işi yapma biçimi farklıdır.', exampleSentence: 'Her yiğidin bir yoğurt yiyişi vardır, kimse kimseye benzemez.', plateCode: '06' },
  { word: 'Çıkmadık candan umut kesilmez.', type: 'atasözü', meaning: 'Hayat devam ettiği sürece umut vardır.', exampleSentence: 'Çıkmadık candan umut kesilmez, dedem hep söylerdi.', plateCode: '06' },
  { word: 'Arı kovanına çomak sokma.', type: 'atasözü', meaning: 'Tartışmayı kızıştıracak şeyler söyleme.', exampleSentence: 'Arı kovanına çomak sokma, sus sus bitsin.', plateCode: '06' },
  { word: 'Minareyi çalan kılıfını hazırlar.', type: 'atasözü', meaning: 'Büyük iş yapan, sonrasını da planlar.', exampleSentence: 'O kadar planlı ki minareyi çalan kılıfını hazırlar.', plateCode: '06' },
  { word: 'Çok bilen çok yanılır.', type: 'atasözü', meaning: 'Çok bildiğini sanan çok hata yapar.', exampleSentence: 'Çok bilen çok yanılır, mütevazı ol.', plateCode: '06' },
  { word: 'Gülme komşuna, gelir başına.', type: 'atasözü', meaning: 'Başkasının başına gelen olaylar sana da olabilir.', exampleSentence: 'Gülme komşuna gelir başına, dedelerimiz boşuna dememiş.', plateCode: '06' },
  { word: 'Üzüm üzüme baka baka kararır.', type: 'atasözü', meaning: 'İnsanlar çevresinden etkilenir.', exampleSentence: 'Üzüm üzüme baka baka kararır, çevreni iyi seç.', plateCode: '06' },
  { word: 'Ağaç yaşken eğilir.', type: 'atasözü', meaning: 'Çocuklar küçükken eğitilmelidir.', exampleSentence: 'Ağaç yaşken eğilir, çocukları küçükken öğret.', plateCode: '06' },
];

/**
 * Search token'larını entry'nin word + meaning alanlarından hesapla.
 * - Türkçe lower-case
 * - Noktalama işaretlerini temizle
 * - Her kelime + her prefix (2-4 karakter) token olarak eklenir
 * - Toplam 50 token ile sınırlı (Firestore array-contains-any sınırı)
 */
function computeSearchTokens(word: string, meaning: string, exampleSentence = ''): string[] {
  const text = [word, meaning, exampleSentence].join(' ');
  const normalized = text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = new Set<string>();
  for (const w of normalized.split(' ')) {
    if (w.length < 2) continue;
    tokens.add(w);
    for (let i = 2; i <= Math.min(4, w.length); i++) {
      tokens.add(w.slice(0, i));
    }
  }

  return Array.from(tokens).slice(0, 50);
}

async function seedEntries(): Promise<void> {
  const batch = db.batch();
  let count = 0;
  const skipped: string[] = [];

  for (const entry of ENTRIES) {
    const regionRef = db.collection('regions').doc(entry.plateCode);
    const regionSnap = await regionRef.get();
    if (!regionSnap.exists) {
      skipped.push(`${entry.plateCode} (${entry.word})`);
      continue;
    }

    const ref = db.collection('entries').doc();
    batch.set(ref, {
      word: entry.word,
      type: entry.type,
      meaning: entry.meaning,
      exampleSentence: entry.exampleSentence,
      regionId: entry.plateCode,
      contributorId: SEED_USER_ID,
      contributorName: CONTRIBUTOR_NAME,
      status: 'active',
      removedReason: null,
      removedBy: null,
      removedAt: null,
      likeCount: 0,
      searchTokens: computeSearchTokens(entry.word, entry.meaning, entry.exampleSentence),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    count++;
  }

  await batch.commit();
  console.log(`✓ ${count} örnek entry yüklendi.`);

  if (skipped.length > 0) {
    console.log(`\n⚠ ${skipped.length} entry atlandı (bölge bulunamadı):`);
    for (const s of skipped) console.log(`  - ${s}`);
  }

  // Özet: type dağılımı
  const stats = ENTRIES.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\nDağılım:');
  for (const [type, n] of Object.entries(stats)) {
    console.log(`  ${type}: ${n}`);
  }
}

seedEntries().catch((err: unknown) => { console.error(err); process.exit(1); });