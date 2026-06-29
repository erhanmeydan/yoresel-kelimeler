import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { computeSearchTokens } from '../src/utils/searchTokens';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

// Service account
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
  console.log(`${snap.size} entry bulundu, searchTokens güncelleniyor...`);

  let count = 0;
  const batches: FirebaseFirestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let batchOps = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const tokens = computeSearchTokens(data.word ?? '', data.meaning ?? '', data.exampleSentence ?? '');
    currentBatch.update(doc.ref, { searchTokens: tokens });
    batchOps++;
    count++;

    // Firestore batch limit: 500 operations
    if (batchOps >= 400) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) batches.push(currentBatch);

  for (const batch of batches) {
    await batch.commit();
  }

  console.log(`✓ ${count} entry'nin searchTokens alanı güncellendi (${batches.length} batch).`);
}

backfill().catch((err: unknown) => { console.error(err); process.exit(1); });