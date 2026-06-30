import { collection, query, orderBy, limit, getDocs, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Comment, ServiceResult } from '../types/models';

export async function listAllComments(
  db: Firestore,
  max = 50,
): Promise<ServiceResult<Comment[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.COMMENTS),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment);
    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: 'comments/admin-list-failed', message: 'Yorumlar yüklenemedi.' } };
  }
}