import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  assertIsAdmin,
  writeAuditLog,
  incrementCounter,
  getCounters,
} from './adminHelpers';

export const moderateComment = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  const admin = await assertIsAdmin(req);
  const { commentId } = req.data;
  if (typeof commentId !== 'string') {
    throw new HttpsError('invalid-argument', 'commentId zorunlu.');
  }

  await getFirestore().collection('comments').doc(commentId).delete();
  await writeAuditLog({
    action: 'comment.delete',
    targetType: 'comment',
    targetId: commentId,
    actorUid: admin.uid,
    actorName: admin.displayName,
  });
  await incrementCounter('commentsDeletedToday');

  return { ok: true };
});

export const blockUser = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  const admin = await assertIsAdmin(req);
  const { targetUid, reason } = req.data;
  if (typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'targetUid zorunlu.');
  }
  if (targetUid === admin.uid) {
    throw new HttpsError('failed-precondition', 'Kendini engelleyemezsin.');
  }

  await getFirestore().collection('blockedUsers').doc(targetUid).set({
    uid: targetUid,
    blockedBy: admin.uid,
    blockedAt: new Date(),
    reason: reason ?? null,
  }, { merge: false });

  await writeAuditLog({
    action: 'user.block',
    targetType: 'user',
    targetId: targetUid,
    actorUid: admin.uid,
    actorName: admin.displayName,
    metadata: { reason: reason ?? null },
  });
  await incrementCounter('blockedUsersCount', +1);

  return { ok: true };
});

export const unblockUser = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  const admin = await assertIsAdmin(req);
  const { targetUid } = req.data;
  if (typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'targetUid zorunlu.');
  }

  await getFirestore().collection('blockedUsers').doc(targetUid).delete();

  await writeAuditLog({
    action: 'user.unblock',
    targetType: 'user',
    targetId: targetUid,
    actorUid: admin.uid,
    actorName: admin.displayName,
  });
  await incrementCounter('blockedUsersCount', -1);

  return { ok: true };
});

export const getAdminStats = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  await assertIsAdmin(req);
  const counters = await getCounters([
    'reportsOpen',
    'commentsDeletedToday',
    'blockedUsersCount',
  ]);
  return counters;
});

export const restoreComment = onCall({ cors: [/firebasehost\.com$/] }, async (req) => {
  const admin = await assertIsAdmin(req);
  const { commentId } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof commentId !== 'string') {
    throw new HttpsError('invalid-argument', 'commentId zorunlu.');
  }

  await getFirestore().collection('comments').doc(commentId).update({
    status: 'active',
  });

  await writeAuditLog({
    action: 'comment.restore',
    targetType: 'comment',
    targetId: commentId,
    actorUid: admin.uid,
    actorName: admin.displayName,
  });

  return { ok: true };
});