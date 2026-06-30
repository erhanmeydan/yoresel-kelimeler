import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { computeSearchTokens } from '../../src/utils/searchTokens';
import { logger } from 'firebase-functions';

export const onEntryCreate = onDocumentCreated('entries/{entryId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const db = getFirestore();
  const entryId = event.params.entryId;
  const regionId = data.regionId as string;

  // 1. Set searchTokens (existing behavior)
  const tokens = computeSearchTokens(data.word ?? '', data.meaning ?? '', data.exampleSentence ?? '');
  await db.doc(`entries/${entryId}`).update({ searchTokens: tokens });

  // 2. Increment regionStats/{regionId} for real-time leaderboard
  // Skip if not active or no regionId
  if (data.status !== 'active' || !regionId) {
    logger.info(`[onEntryCreate] skip stats: status=${data.status}, regionId=${regionId}`);
    return;
  }

  try {
    // Fetch region name
    const regionSnap = await db.doc(`regions/${regionId}`).get();
    const regionName = (regionSnap.data()?.name as string) ?? regionId;

    const statsRef = db.doc(`regionStats/${regionId}`);

    const updateData = {
      regionId,
      regionName,
      entryCount: FieldValue.increment(1),
      sampleEntryId: entryId,
      sampleWord: (data.word as string) ?? '',
      sampleMeaning: ((data.meaning as string) ?? '').slice(0, 80),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await statsRef.set(updateData, { merge: true });
    logger.info(`[onEntryCreate] updated regionStats/${regionId} (+1)`);
  } catch (err) {
    logger.error(`[onEntryCreate] failed to update regionStats/${regionId}`, err);
  }
});