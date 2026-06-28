import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const moderateEntry = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş gerekli.');

  const db = getFirestore();
  const userDoc = await db.doc(`users/${request.auth.uid}`).get();
  const role = userDoc.data()?.role;
  if (role !== 'moderator' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Yetkisiz.');
  }

  const { entryId, action, reason } = request.data as { entryId: string; action: string; reason: string };

  return db.runTransaction(async (tx) => {
    const entryRef = db.doc(`entries/${entryId}`);
    const entrySnap = await tx.get(entryRef);
    if (!entrySnap.exists) throw new HttpsError('not-found', 'Kayıt yok.');

    const prevValue = entrySnap.data();
    const updates: Record<string, unknown> = {};

    if (action === 'remove') {
      updates.status = 'removed';
      updates.removedReason = reason;
      updates.removedBy = request.auth!.uid;
      updates.removedAt = new Date();
    } else if (action === 'restore') {
      updates.status = 'active';
      updates.removedReason = null;
      updates.removedBy = null;
      updates.removedAt = null;
    } else {
      throw new HttpsError('invalid-argument', 'Geçersiz aksiyon.');
    }

    tx.update(entryRef, updates);
    tx.create(db.collection('moderationLog').doc(), {
      entryId,
      moderatorId: request.auth!.uid,
      action,
      reason,
      prevValue,
      createdAt: new Date(),
    });

    return true;
  });
});
