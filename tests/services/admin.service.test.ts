import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteComment, blockUser, unblockUser, getAdminStats } from '../../src/services/admin.service';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn(),
}));

describe('admin.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteComment', () => {
    it('returns ok on success', async () => {
      const { httpsCallable } = await import('firebase/functions');
      vi.mocked(httpsCallable).mockReturnValue((() => Promise.resolve({ data: null })) as any);
      const result = await deleteComment('c1');
      expect(result.ok).toBe(true);
    });

    it('returns error on callable failure', async () => {
      const { httpsCallable } = await import('firebase/functions');
      vi.mocked(httpsCallable).mockReturnValue((() => Promise.reject({ code: 'admin/error' })) as any);
      const result = await deleteComment('c1');
      expect(result.ok).toBe(false);
      expect(result.error?.code).toMatch(/^admin\//);
    });
  });

  describe('blockUser', () => {
    it('passes reason when provided', async () => {
      const { httpsCallable } = await import('firebase/functions');
      const mockFn = vi.fn().mockResolvedValue({ data: null });
      vi.mocked(httpsCallable).mockReturnValue(mockFn as any);
      await blockUser('u1', 'spam');
      expect(mockFn).toHaveBeenCalledWith({ targetUid: 'u1', reason: 'spam' });
    });
  });

  describe('unblockUser', () => {
    it('calls unblockUser callable', async () => {
      const { httpsCallable } = await import('firebase/functions');
      const mockFn = vi.fn().mockResolvedValue({ data: null });
      vi.mocked(httpsCallable).mockReturnValue(mockFn as any);
      await unblockUser('u1');
      expect(mockFn).toHaveBeenCalledWith({ targetUid: 'u1' });
    });
  });

  describe('getAdminStats', () => {
    it('returns data from callable', async () => {
      const { httpsCallable } = await import('firebase/functions');
      const stats = { reportsOpen: 5, commentsDeletedToday: 3, blockedUsersCount: 2 };
      vi.mocked(httpsCallable).mockReturnValue((() => Promise.resolve({ data: stats })) as any);
      const result = await getAdminStats();
      expect(result.ok).toBe(true);
      expect(result.data).toEqual(stats);
    });
  });
});
