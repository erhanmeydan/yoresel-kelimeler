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
    const statsCollection = db.collection('regionStats');

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
