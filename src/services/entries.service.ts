import {
  collection, query, where, orderBy, limit, getDocs,
  type Firestore,
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