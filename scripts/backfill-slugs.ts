import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { generateUniqueSlug } from '../src/utils/slug';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

function loadServiceAccount(): Record<string, unknown> {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (fromEnv && fromEnv.trim().length > 0) {
    try { return JSON.parse(fromEnv); }
    catch (err) { console.error('env parse hatası:', err); process.exit(1); }
  }
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? resolve(__dirname, '../service-account.json');
  if (existsSync(filePath)) {
    try { return JSON.parse(readFileSync(filePath, 'utf8')); }
    catch (err) { console.error(`${filePath} okuma hatası:`, err); process.exit(1); }
  }
  console.error('Service account bulunamadı.');
  process.exit(1);
}

const app = initializeApp({ credential: cert(loadServiceAccount() as Parameters<typeof cert>[0]) });
const db = getFirestore(app);

async function backfill(): Promise<void> {
  const snap = await db.collection('entries').get();
  console.log(`${snap.size} entry bulundu, slug üretiliyor...`);

  const existing = new Set<string>();
  let batch = db.batch();
  let count = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const word = (data.word as string) ?? '';
    const slug = generateUniqueSlug(word, existing);
    existing.add(slug);

    batch.update(docSnap.ref, { slug });
    count++;

    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();

  console.log(`✓ ${count} entry'ye slug eklendi.`);
}

backfill().catch((err: unknown) => { console.error(err); process.exit(1); });