import { addDoc, collection, getDocs, query, where, orderBy, serverTimestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Report, ServiceResult } from '../types/models';

export async function createReport(
  db: Firestore, entryId: string, reporterId: string, reason: string,
): Promise<ServiceResult<string>> {
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.REPORTS), {
      entryId, reporterId, reason,
      status: 'open',
      resolvedBy: null,
      createdAt: serverTimestamp(),
    });
    return { ok: true, data: ref.id };
  } catch {
    return { ok: false, error: { code: 'reports/create-failed', message: 'Rapor gönderilemedi.' } };
  }
}

export async function listOpenReports(db: Firestore): Promise<ServiceResult<Report[]>> {
  try {
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.REPORTS),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
    ));
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Report) };
  } catch {
    return { ok: false, error: { code: 'reports/list-failed', message: 'Raporlar yüklenemedi.' } };
  }
}