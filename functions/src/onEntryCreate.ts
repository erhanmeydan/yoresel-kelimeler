import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { computeSearchTokens } from '../../src/utils/searchTokens';

export const onEntryCreate = onDocumentCreated('entries/{entryId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const tokens = computeSearchTokens(data.word ?? '', data.meaning ?? '', data.exampleSentence ?? '');
  await getFirestore().doc(`entries/${event.params.entryId}`).update({ searchTokens: tokens });
});