import { collection, query, where, orderBy, limit, startAfter, getDocs, type Firestore } from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { COLLECTIONS } from '../../config/constants';
import type { Entry, ServiceResult } from '../../types/models';

interface ListFilters {
  status?: 'active' | 'removed';
  regionId?: string;
  q?: string;
}

export async function listEntries(
  db: Firestore,
  filters: ListFilters = {},
  pageSize = 25,
  cursor?: unknown,
): Promise<ServiceResult<{ items: Entry[]; hasMore: boolean; lastVisible?: unknown }>> {
  try {
    const constraints = [
      ...(filters.status ? [where('status', '==', filters.status)] : []),
      ...(filters.regionId ? [where('regionId', '==', filters.regionId)] : []),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1), // +1 to detect hasMore
      ...(cursor ? [startAfter(cursor)] : []),
    ];
    const q = query(collection(db, COLLECTIONS.ENTRIES), ...constraints);
    const snap = await getDocs(q);
    const docs = snap.docs.slice(0, pageSize);
    const items = docs.map(d => ({ id: d.id, ...d.data() } as Entry));
    const hasMore = snap.docs.length > pageSize;
    const lastVisible = snap.docs[pageSize - 1];
    return { ok: true, data: { items, hasMore, lastVisible } };
  } catch (err) {
    return { ok: false, error: { code: 'entries/list-failed', message: 'Maddeler yüklenemedi.' } };
  }
}

export async function softDeleteEntry(entryId: string, reason: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'moderateEntry');
    await fn({ entryId, action: 'remove', reason });
    return { ok: true, data: null };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'entries/delete-failed';
    return { ok: false, error: { code, message: 'Entry silinemedi.' } };
  }
}

export async function restoreEntry(entryId: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'restoreEntry');
    await fn({ entryId });
    return { ok: true, data: null };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'entries/restore-failed';
    return { ok: false, error: { code, message: 'Entry geri yüklenemedi.' } };
  }
}
