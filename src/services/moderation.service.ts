import { doc, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/app';

export async function removeEntryRemote(
  db: Firestore, entryId: string, reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const fn = httpsCallable(getFunctions(), 'moderateEntry');
    const result = await fn({ entryId, action: 'remove', reason });
    return { ok: result.data === true };
  } catch {
    return { ok: false, error: 'İşlem başarısız.' };
  }
}
