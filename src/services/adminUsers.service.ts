import { collection, query, orderBy, getDocs, type Firestore, Timestamp } from 'firebase/firestore';
import type { ServiceResult } from '../types/models';

export interface BlockedUser {
  uid: string;
  blockedBy: string;
  blockedAt: Timestamp;
  reason: string | null;
}

export async function listBlockedUsers(db: Firestore): Promise<ServiceResult<BlockedUser[]>> {
  try {
    const q = query(collection(db, 'blockedUsers'), orderBy('blockedAt', 'desc'));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => d.data() as BlockedUser);
    return { ok: true, data };
  } catch (err) {
    console.error('[listBlockedUsers] firestore error:', err);
    return {
      ok: false,
      error: {
        code: `admin/blocked-list-failed:${(err as { code?: string }).code ?? 'unknown'}`,
        message: `Engellenen kullanıcılar yüklenemedi: ${(err as Error).message ?? 'bilinmeyen hata'}`,
      },
    };
  }
}