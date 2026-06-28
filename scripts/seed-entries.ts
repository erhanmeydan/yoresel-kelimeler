import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
const app = initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
const db = getFirestore(app);

const SEED_USER_ID = 'seed@system.local';

interface SeedEntry {
  word: string; type: 'kelime' | 'deyim' | 'atasözü';
  meaning: string; exampleSentence: string; plateCode: string;
}

const ENTRIES: SeedEntry[] = [
  { word: 'paldum', type: 'kelime', meaning: 'Ağaç kütüğü, tomruk.', exampleSentence: 'Paldumu baltayla yardı.', plateCode: '53' },
  { word: 'höllük', type: 'kelime', meaning: 'Vadi, dere yatağı.', exampleSentence: 'Höllüğe doğru indik.', plateCode: '61' },
  // ... (her bölgeden 8-12 entry ekleyin, toplam ~80)
  { word: 'eşek şakası', type: 'deyim', meaning: 'Abartılı, inandırıcı olmayan şaka.', exampleSentence: 'Bu eşek şakası mı?', plateCode: '34' },
  { word: 'hamdolsun', type: 'kelime', meaning: 'Şükürler olsun.', exampleSentence: 'Hamdolsun bugün de sağ salim.', plateCode: '06' },
];

async function seedEntries(): Promise<void> {
  const batch = db.batch();
  let count = 0;

  for (const entry of ENTRIES) {
    const regionRef = db.collection('regions').doc(entry.plateCode);
    const regionSnap = await regionRef.get();
    if (!regionSnap.exists) {
      console.warn(`Bölge bulunamadı: ${entry.plateCode}`);
      continue;
    }
    const regionData = regionSnap.data()!;

    const ref = db.collection('entries').doc();
    batch.set(ref, {
      word: entry.word,
      type: entry.type,
      meaning: entry.meaning,
      exampleSentence: entry.exampleSentence,
      regionId: entry.plateCode,
      contributorId: SEED_USER_ID,
      contributorName: 'Kültürel Kaynak',
      status: 'active',
      removedReason: null,
      removedBy: null,
      removedAt: null,
      likeCount: 0,
      searchTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    count++;
  }

  await batch.commit();
  console.log(`✓ ${count} örnek entry yüklendi (${regionData?.name ?? '?'})`);
}

seedEntries().catch((err: unknown) => { console.error(err); process.exit(1); });