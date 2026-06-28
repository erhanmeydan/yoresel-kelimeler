import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';

function generateTokens(text: string): string[] {
  const normalized = text.toLocaleLowerCase('tr-TR').trim();
  const tokens = new Set<string>();

  // Kelime token'ları
  for (const word of normalized.split(/\s+/)) {
    if (word.length >= 2) tokens.add(word);
    // Prefix (autocomplete için)
    for (let i = 2; i <= Math.min(word.length, 10); i++) {
      tokens.add(word.slice(0, i));
    }
  }

  return [...tokens];
}

export const onEntryCreate = onDocumentCreated('entries/{entryId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const tokens = generateTokens(`${data.word} ${data.meaning} ${data.exampleSentence}`);
  await getFirestore().doc(`entries/${event.params.entryId}`).update({ searchTokens: tokens });
});