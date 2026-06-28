import {
  collection, query, where, orderBy, limit, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment,
  type Firestore, type DocumentData,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Entry, ServiceResult } from '../types/models';

export async function listEntriesByRegion(
  db: Firestore, regionId: string, max = 50,
): Promise<ServiceResult<Entry[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.ENTRIES),
      where('regionId', '==', regionId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry) };
  } catch {
    return { ok: false, error: { code: 'entries/list-failed', message: 'Kayıtlar yüklenemedi.' } };
  }
}

export async function listTrendingEntries(
  db: Firestore, max = 20,
): Promise<ServiceResult<Entry[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.ENTRIES),
      where('status', '==', 'active'),
      orderBy('likeCount', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry) };
  } catch {
    return { ok: false, error: { code: 'entries/trending-failed', message: 'Trend kayıtlar yüklenemedi.' } };
  }
}

export async function createEntry(
  db: Firestore, input: {
    word: string; meaning: string; exampleSentence: string;
    type: Entry['type']; regionId: string; contributorId: string; contributorName: string;
  },
): Promise<ServiceResult<string>> {
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.ENTRIES), {
      ...input,
      status: 'active',
      removedReason: null,
      removedBy: null,
      removedAt: null,
      likeCount: 0,
      searchTokens: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies DocumentData);
    return { ok: true, data: ref.id };
  } catch (err) {
    return { ok: false, error: { code: 'entries/create-failed', message: 'Kayıt oluşturulamadı.', detail: String(err) } };
  }
}

export async function updateOwnEntry(
  db: Firestore, entryId: string, patch: Partial<Pick<Entry, 'word' | 'meaning' | 'exampleSentence' | 'type'>>,
): Promise<ServiceResult<null>> {
  try {
    await updateDoc(doc(db, COLLECTIONS.ENTRIES, entryId), { ...patch, updatedAt: serverTimestamp() });
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'entries/update-failed', message: 'Güncellenemedi.' } };
  }
}

export async function deleteOwnEntry(db: Firestore, entryId: string): Promise<ServiceResult<null>> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.ENTRIES, entryId));
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'entries/delete-failed', message: 'Silinemedi.' } };
  }
}

export async function incrementLike(db: Firestore, entryId: string, delta: 1 | -1): Promise<ServiceResult<null>> {
  try {
    await updateDoc(doc(db, COLLECTIONS.ENTRIES, entryId), { likeCount: increment(delta) });
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'entries/like-failed', message: 'Beğeni işlemi başarısız.' } };
  }
}

export async function searchEntries(
  db: Firestore, query_text: string, max = 30,
): Promise<ServiceResult<Entry[]>> {
  const tokens = query_text.toLocaleLowerCase('tr-TR').split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return { ok: true, data: [] };

  try {
    const q = query(
      collection(db, COLLECTIONS.ENTRIES),
      where('status', '==', 'active'),
      where('searchTokens', 'array-contains-any', tokens.slice(0, 10)),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry) };
  } catch {
    return { ok: false, error: { code: 'entries/search-failed', message: 'Arama başarısız.' } };
  }
}