import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
  type Firestore,
  serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '../../config/constants';
import type { Report, ServiceResult } from '../../types/models';

interface ListFilters {
  status?: 'open' | 'resolved' | 'dismissed';
}

export async function listReports(
  db: Firestore,
  filters: ListFilters = {},
  pageSize = 25,
  cursor?: unknown,
): Promise<ServiceResult<{ items: Report[]; hasMore: boolean; lastVisible?: unknown }>> {
  try {
    const constraints = [
      ...(filters.status ? [where('status', '==', filters.status)] : []),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1),
      ...(cursor ? [startAfter(cursor)] : []),
    ];
    const q = query(collection(db, COLLECTIONS.REPORTS), ...constraints);
    const snap = await getDocs(q);
    const docs = snap.docs.slice(0, pageSize);
    const items = docs.map(d => ({ id: d.id, ...d.data() } as Report));
    const hasMore = snap.docs.length > pageSize;
    const lastVisible = snap.docs[pageSize - 1];
    return { ok: true, data: { items, hasMore, lastVisible } };
  } catch (err) {
    return { ok: false, error: { code: 'reports/list-failed', message: 'Raporlar yüklenemedi.' } };
  }
}

export async function resolveReport(
  db: Firestore,
  reportId: string,
  modUid: string,
): Promise<ServiceResult<null>> {
  try {
    await updateDoc(doc(db, COLLECTIONS.REPORTS, reportId), {
      status: 'resolved',
      resolvedBy: modUid,
      resolvedAt: serverTimestamp(),
    });
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'reports/resolve-failed', message: 'Rapor çözülemedi.' } };
  }
}

export async function dismissReport(
  db: Firestore,
  reportId: string,
  modUid: string,
): Promise<ServiceResult<null>> {
  try {
    await updateDoc(doc(db, COLLECTIONS.REPORTS, reportId), {
      status: 'dismissed',
      resolvedBy: modUid,
      resolvedAt: serverTimestamp(),
    });
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'reports/dismiss-failed', message: 'Rapor reddedilemedi.' } };
  }
}