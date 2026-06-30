import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAllComments } from '../../src/services/commentsModeration.service';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
}));

describe('commentsModeration.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listAllComments', () => {
    it('returns empty array when no docs', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);
      const result = await listAllComments({} as any, 50);
      expect(result.ok).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('maps docs to Comment array', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { id: 'c1', data: () => ({ id: 'c1', text: 'hello', authorName: 'User' }) },
        ],
      } as any);
      const result = await listAllComments({} as any, 50);
      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].text).toBe('hello');
    });

    it('returns error on firestore failure', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockRejectedValue(new Error('firestore error'));
      const result = await listAllComments({} as any);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toMatch(/^comments\//);
    });
  });
});
