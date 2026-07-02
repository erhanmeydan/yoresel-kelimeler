import { describe, it, expect, vi } from 'vitest';
import { listEntries, softDeleteEntry, restoreEntry } from '../../../src/services/admin/entriesModeration.service';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
  getFunctions: vi.fn(),
}));

describe('entriesModeration.service', () => {
  it('listEntries returns ServiceResult', async () => {
    const result = await listEntries({ status: 'active' } as any);
    expect(result).toBeDefined();
    expect(typeof result.ok).toBe('boolean');
  });

  it('softDeleteEntry calls moderateEntry with remove action', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { ok: true } });
    const { httpsCallable } = await import('firebase/functions');
    vi.mocked(httpsCallable).mockReturnValue(mockFn as never);
    await softDeleteEntry('e1', 'spam');
    expect(mockFn).toHaveBeenCalledWith({ entryId: 'e1', action: 'remove', reason: 'spam' });
  });

  it('restoreEntry calls restoreEntry callable', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { ok: true } });
    const { httpsCallable } = await import('firebase/functions');
    vi.mocked(httpsCallable).mockReturnValue(mockFn as never);
    await restoreEntry('e1');
    expect(mockFn).toHaveBeenCalledWith({ entryId: 'e1' });
  });
});
