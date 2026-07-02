import { httpsCallable, getFunctions } from 'firebase/functions';
import type { ServiceResult } from '../types/models';

export interface AdminStats {
  reportsOpen: number;
  commentsDeletedToday: number;
  blockedUsersCount: number;
}

export async function deleteComment(commentId: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'moderateComment');
    await fn({ commentId });
    return { ok: true, data: null };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'admin/unknown';
    return { ok: false, error: { code, message: 'Yorum silinemedi.' } };
  }
}

export async function blockUser(targetUid: string, reason?: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'blockUser');
    await fn({ targetUid, reason });
    return { ok: true, data: null };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'admin/unknown';
    return { ok: false, error: { code, message: 'Kullanıcı engellenemedi.' } };
  }
}

export async function unblockUser(targetUid: string): Promise<ServiceResult<null>> {
  try {
    const fn = httpsCallable(getFunctions(), 'unblockUser');
    await fn({ targetUid });
    return { ok: true, data: null };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'admin/unknown';
    return { ok: false, error: { code, message: 'Engel kaldırılamadı.' } };
  }
}

export async function getAdminStats(): Promise<ServiceResult<AdminStats>> {
  try {
    const fn = httpsCallable<unknown, AdminStats>(getFunctions(), 'getAdminStats');
    const result = await fn();
    return { ok: true, data: result.data };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'admin/unknown';
    return { ok: false, error: { code, message: 'İstatistikler yüklenemedi.' } };
  }
}