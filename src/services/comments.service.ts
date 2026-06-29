import {
  addDoc, collection, query, where, orderBy, limit, getDocs,
  deleteDoc, doc, serverTimestamp, type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Comment, ServiceResult } from '../types/models';

export async function addComment(
  db: Firestore,
  entryId: string,
  authorId: string,
  authorName: string,
  text: string,
): Promise<ServiceResult<string>> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { code: 'comments/empty', message: 'Yorum boş olamaz.' } };
  }
  if (trimmed.length > 500) {
    return { ok: false, error: { code: 'comments/too-long', message: 'Yorum 500 karakteri geçemez.' } };
  }
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.COMMENTS), {
      entryId,
      authorId,
      authorName,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    return { ok: true, data: ref.id };
  } catch {
    return { ok: false, error: { code: 'comments/create-failed', message: 'Yorum eklenemedi.' } };
  }
}

export async function listComments(
  db: Firestore, entryId: string, max = 50,
): Promise<ServiceResult<Comment[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.COMMENTS),
      where('entryId', '==', entryId),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment) };
  } catch {
    return { ok: false, error: { code: 'comments/list-failed', message: 'Yorumlar yüklenemedi.' } };
  }
}

export async function listOwnComments(
  db: Firestore, authorId: string, max = 100,
): Promise<ServiceResult<Comment[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.COMMENTS),
      where('authorId', '==', authorId),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment) };
  } catch {
    return { ok: false, error: { code: 'comments/own-list-failed', message: 'Yorumlarınız yüklenemedi.' } };
  }
}

export async function deleteComment(
  db: Firestore, commentId: string,
): Promise<ServiceResult<null>> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.COMMENTS, commentId));
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'comments/delete-failed', message: 'Yorum silinemedi.' } };
  }
}