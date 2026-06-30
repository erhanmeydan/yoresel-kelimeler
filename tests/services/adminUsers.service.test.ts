import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listBlockedUsers } from '../../src/services/adminUsers.service';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
}));

describe('adminUsers.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listBlockedUsers', () => {
    it('returns empty array when no docs', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);
      const result = await listBlockedUsers({} as any);
      expect(result.ok).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('returns error on firestore failure', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockRejectedValue(new Error('firestore error'));
      const result = await listBlockedUsers({} as any);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toMatch(/^admin\//);
    });
  });
});
