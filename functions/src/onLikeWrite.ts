import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Per-user like model (#9): the client may only create/delete its own
// entries/{entryId}/likes/{uid} doc. The authoritative likeCount on the parent
// entry is maintained here (admin SDK), so it can no longer be inflated by a
// direct likeCount write.

export const onLikeCreate = onDocumentCreated('entries/{entryId}/likes/{uid}', async (event) => {
  await getFirestore()
    .doc(`entries/${event.params.entryId}`)
    .update({ likeCount: FieldValue.increment(1) });
});

export const onLikeDelete = onDocumentDeleted('entries/{entryId}/likes/{uid}', async (event) => {
  await getFirestore()
    .doc(`entries/${event.params.entryId}`)
    .update({ likeCount: FieldValue.increment(-1) });
});
