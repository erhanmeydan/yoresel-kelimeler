import {
  collection, query, where, orderBy, limit, getDocs, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  type Firestore, type DocumentData,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Entry, ServiceResult } from '../types/models';

export async function getEntry(
  db: Firestore, entryId: string,
): Promise<ServiceResult<Entry>> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.ENTRIES, entryId));
    if (!snap.exists()) {
      return { ok: false, error: { code: 'entries/not-found', message: 'Kayıt bulunamadı.' } };
    }
    return { ok: true, data: { id: snap.id, ...snap.data() } as Entry };
  } catch {
    return { ok: false, error: { code: 'entries/get-failed', message: 'Kayıt yüklenemedi.' } };
  }
}

export async function getEntryBySlug(
  db: Firestore, slug: string,
): Promise<ServiceResult<Entry>> {
  try {
    // Index gerektirmeyen client-side filter — Firestore rules gereği
    // status='active' filtresi zorunlu (active olan herkes okuyabilir).
    // Tek alanlı equality olduğu için composite index gerekmez.
    const q = query(
      collection(db, COLLECTIONS.ENTRIES!),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    const d = snap.docs.find((docSnap) => (docSnap.data().slug as string) === slug);
    if (!d) {
      return { ok: false, error: { code: 'entries/not-found', message: 'Kayıt bulunamadı.' } };
    }
    return { ok: true, data: { id: d.id, ...d.data() } as Entry };
  } catch (err) {
    console.error('[getEntryBySlug] error:', err);
    return { ok: false, error: { code: 'entries/get-failed', message: 'Kayıt yüklenemedi.' } };
  }
}

export async function listAllSlugs(db: Firestore): Promise<Set<string>> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.ENTRIES));
    return new Set(snap.docs.map((d) => (d.data().slug as string)).filter(Boolean));
  } catch {
    return new Set();
  }
}

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

export async function listRecentEntries(
  db: Firestore, max = 10,
): Promise<ServiceResult<Entry[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.ENTRIES),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry) };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    console.error('[listRecentEntries] firestore error:', code, err);
    return { ok: false, error: { code: `entries/recent-failed:${code}`, message: 'Son kayıtlar yüklenemedi.' } };
  }
}

export async function listOwnEntries(
  db: Firestore, contributorId: string, max = 100,
): Promise<ServiceResult<Entry[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.ENTRIES),
      where('contributorId', '==', contributorId),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry) };
  } catch {
    return { ok: false, error: { code: 'entries/own-list-failed', message: 'Katkılarınız yüklenemedi.' } };
  }
}

export async function createEntry(
  db: Firestore, input: {
    slug: string;
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
  db: Firestore, entryId: string, patch: Partial<Pick<Entry, 'word' | 'meaning' | 'exampleSentence' | 'type' | 'regionId'>>,
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

// Per-user like model (#9): the client writes only its own likes/{uid} doc.
// likeCount on the entry is maintained server-side by the onLike* Cloud Functions.
export async function likeEntry(db: Firestore, entryId: string, uid: string): Promise<ServiceResult<null>> {
  try {
    await setDoc(doc(db, COLLECTIONS.ENTRIES, entryId, 'likes', uid), { createdAt: serverTimestamp() });
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'entries/like-failed', message: 'Beğeni işlemi başarısız.' } };
  }
}

export async function unlikeEntry(db: Firestore, entryId: string, uid: string): Promise<ServiceResult<null>> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.ENTRIES, entryId, 'likes', uid));
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'entries/unlike-failed', message: 'Beğeni geri alınamadı.' } };
  }
}

export async function hasLiked(db: Firestore, entryId: string, uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.ENTRIES, entryId, 'likes', uid));
    return snap.exists();
  } catch {
    return false;
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