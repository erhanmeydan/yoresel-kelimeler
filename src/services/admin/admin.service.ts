import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type Firestore,
} from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { COLLECTIONS } from '../../config/constants';
import type { Comment, ServiceResult } from '../../types/models';

export async function deleteComment(commentId: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'moderateComment');
    await fn({ commentId });
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: { code: 'admin/comment-delete-failed', message: 'Yorum silinemedi.' } };
  }
}

export async function restoreComment(commentId: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'restoreComment');
    await fn({ commentId });
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: { code: 'admin/comment-restore-failed', message: 'Yorum geri yüklenemedi.' } };
  }
}

export async function listAllComments(
  db: Firestore,
  filters: { status?: 'active' | 'removed' } = {},
  pageSize = 25,
  cursor?: unknown,
): Promise<ServiceResult<{ items: Comment[]; hasMore: boolean; lastVisible?: unknown }>> {
  try {
    const constraints = [
      ...(filters.status ? [where('status', '==', filters.status)] : []),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1),
      ...(cursor ? [startAfter(cursor)] : []),
    ];
    const q = query(collection(db, COLLECTIONS.COMMENTS), ...constraints);
    const snap = await getDocs(q);
    const docs = snap.docs.slice(0, pageSize);
    const items = docs.map(d => ({ id: d.id, ...d.data() } as Comment));
    const hasMore = snap.docs.length > pageSize;
    return { ok: true, data: { items, hasMore, lastVisible: snap.docs[pageSize - 1] } };
  } catch {
    return { ok: false, error: { code: 'admin/comments-list-failed', message: 'Yorumlar yüklenemedi.' } };
  }
}