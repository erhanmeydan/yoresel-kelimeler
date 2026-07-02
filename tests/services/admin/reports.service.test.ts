import { describe, it, expect, vi } from 'vitest';
import { listReports, resolveReport, dismissReport } from '../../../src/services/admin/reports.service';

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
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

const fakeDb = {} as never;

describe('reports.service', () => {
  it('listReports returns ServiceResult', async () => {
    const result = await listReports(fakeDb, {});
    expect(result).toBeDefined();
    expect(typeof result.ok).toBe('boolean');
  });

  it('listReports returns empty items when no docs', async () => {
    const { getDocs } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
    const result = await listReports(fakeDb, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([]);
      expect(result.data.hasMore).toBe(false);
    }
  });

  it('listReports maps docs to Report items', async () => {
    const { getDocs } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'r1', data: () => ({ entryId: 'e1', reporterId: 'u1', reason: 'spam', status: 'open' }) },
        { id: 'r2', data: () => ({ entryId: 'e2', reporterId: 'u2', reason: 'abuse', status: 'open' }) },
      ],
    } as never);
    const result = await listReports(fakeDb, { status: 'open' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0]!.id).toBe('r1');
      expect(result.data.items[1]!.id).toBe('r2');
      expect(result.data.hasMore).toBe(false);
    }
  });

  it('listReports detects hasMore when docs exceed pageSize', async () => {
    const { getDocs } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValue({
      docs: Array.from({ length: 4 }, (_, i) => ({
        id: `r${i}`,
        data: () => ({ entryId: `e${i}`, reporterId: 'u', reason: 'spam', status: 'open' }),
      })),
    } as never);
    const result = await listReports(fakeDb, {}, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(3);
      expect(result.data.hasMore).toBe(true);
    }
  });

  it('resolveReport calls updateDoc with status=resolved', async () => {
    const { updateDoc, doc } = await import('firebase/firestore');
    vi.mocked(doc).mockReturnValue('DOC_REF' as never);
    vi.mocked(updateDoc).mockResolvedValue(undefined as never);
    const result = await resolveReport(fakeDb, 'r1', 'mod1');
    expect(doc).toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'resolved', resolvedBy: 'mod1' }),
    );
    expect(result.ok).toBe(true);
  });

  it('dismissReport calls updateDoc with status=dismissed', async () => {
    const { updateDoc, doc } = await import('firebase/firestore');
    vi.mocked(doc).mockReturnValue('DOC_REF' as never);
    vi.mocked(updateDoc).mockResolvedValue(undefined as never);
    const result = await dismissReport(fakeDb, 'r1', 'mod1');
    expect(doc).toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'dismissed', resolvedBy: 'mod1' }),
    );
    expect(result.ok).toBe(true);
  });

  it('resolveReport returns error when updateDoc throws', async () => {
    const { updateDoc } = await import('firebase/firestore');
    vi.mocked(updateDoc).mockRejectedValue(new Error('boom'));
    const result = await resolveReport(fakeDb, 'r1', 'mod1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('reports/resolve-failed');
    }
  });

  it('dismissReport returns error when updateDoc throws', async () => {
    const { updateDoc } = await import('firebase/firestore');
    vi.mocked(updateDoc).mockRejectedValue(new Error('boom'));
    const result = await dismissReport(fakeDb, 'r1', 'mod1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('reports/dismiss-failed');
    }
  });
});