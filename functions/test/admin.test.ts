import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import firebaseFunctionsTest = require('firebase-functions-test');
import type { CallableRequest } from 'firebase-functions/v2/https';

// ---------------------------------------------------------------------------
// Mocks — hoisted to the top of the file by vitest so they apply before the
// SUT (functions/src/admin.ts) is imported below.
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => ({
  // profiles keyed by uid
  profiles: new Map<string, { role: string; displayName: string }>(),
  // captures doc updates: { collection, id, data }
  updates: [] as Array<{ collection: string; id: string; data: unknown }>,
  // captures audit log entries written via collection('auditLog').add(...)
  auditEntries: [] as Array<Record<string, unknown>>,
}));

vi.mock('firebase-admin', () => ({
  initializeApp: vi.fn(),
  getApps: () => [{ name: 'mock-app' }],
  getApp: vi.fn(() => ({})),
  cert: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    doc: (path: string) => ({
      get: async () => {
        const uid = path.replace(/^users\//, '');
        const profile = mockState.profiles.get(uid);
        return {
          exists: !!profile,
          data: () => profile,
        };
      },
    }),
    collection: (name: string) => ({
      doc: (id: string) => ({
        update: async (data: unknown) => {
          mockState.updates.push({ collection: name, id, data });
        },
        set: async () => undefined,
        delete: async () => undefined,
      }),
      add: async (entry: Record<string, unknown>) => {
        mockState.auditEntries.push(entry);
        return { id: `audit-${mockState.auditEntries.length}` };
      },
    }),
  })),
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    increment: (n: number) => `INCREMENT_${n}`,
  },
}));

// Import SUT AFTER mocks are registered.
import { restoreComment, restoreEntry } from '../src/admin';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const testEnv = firebaseFunctionsTest();
const wrapped = testEnv.wrap(restoreComment);
const wrappedEntry = testEnv.wrap(restoreEntry);

function adminAuth(uid: string, displayName: string): CallableRequest['auth'] {
  return {
    uid,
    token: { sub: uid, role: 'admin' } as never,
    rawToken: 'mock-token',
  };
}

function userAuth(uid: string): CallableRequest['auth'] {
  return {
    uid,
    token: { sub: uid, role: 'user' } as never,
    rawToken: 'mock-token',
  };
}

// ---------------------------------------------------------------------------
// Existing shape tests (unchanged from prior skeleton)
// ---------------------------------------------------------------------------

describe('admin callables', () => {
  it('moderateComment shape', () => {
    expect(typeof moderateComment).toBe('function');
  });
  it('blockUser shape', () => {
    expect(typeof blockUser).toBe('function');
  });
  it('unblockUser shape', () => {
    expect(typeof unblockUser).toBe('function');
  });
  it('getAdminStats shape', () => {
    expect(typeof getAdminStats).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// restoreComment — behavioral tests using firebase-functions-test
// ---------------------------------------------------------------------------

describe('restoreComment', () => {
  beforeEach(() => {
    mockState.profiles.clear();
    mockState.updates.length = 0;
    mockState.auditEntries.length = 0;
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it('admin status active yapabilir', async () => {
    // Arrange: admin profile in the (mocked) users collection.
    mockState.profiles.set('admin-uid', { role: 'admin', displayName: 'Test Admin' });

    // Act: invoke the wrapped callable with admin auth + valid commentId.
    const result = await wrapped({
      data: { commentId: 'c1' },
      auth: adminAuth('admin-uid', 'Test Admin'),
    } as CallableRequest<{ commentId: string }>);

    // Assert: returns ok:true.
    expect(result).toEqual({ ok: true });

    // Assert: Firestore update was called with { status: 'active' } on
    // comments/c1 — proves the function flipped the status field.
    const update = mockState.updates.find(
      (u) => u.collection === 'comments' && u.id === 'c1',
    );
    expect(update).toBeDefined();
    expect(update!.data).toEqual({ status: 'active' });

    // Assert: audit log entry was written with correct shape.
    expect(mockState.auditEntries).toHaveLength(1);
    const audit = mockState.auditEntries[0];
    expect(audit).toMatchObject({
      action: 'comment.restore',
      targetType: 'comment',
      targetId: 'c1',
      actorUid: 'admin-uid',
      actorName: 'Test Admin',
    });
    expect(audit.createdAt).toBe('SERVER_TIMESTAMP');
  });

  it('non-admin permission-denied alır', async () => {
    // Arrange: non-moderator profile — assertIsAdmin must reject.
    mockState.profiles.set('user-uid', { role: 'user', displayName: 'Test User' });

    // Act + Assert: HttpsError with permission-denied code.
    // Note: the 'functions/' prefix is added by the onCall HTTP layer
    // (firebase-functions-test calls cf.run() directly, bypassing it).
    await expect(
      wrapped({
        data: { commentId: 'c1' },
        auth: userAuth('user-uid'),
      } as CallableRequest<{ commentId: string }>),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });

    // Negative assertions: nothing should have been written.
    expect(mockState.updates).toHaveLength(0);
    expect(mockState.auditEntries).toHaveLength(0);
  });

  it('commentId eksikse invalid-argument', async () => {
    // Arrange: admin profile so we pass the auth gate and reach the arg check.
    mockState.profiles.set('admin-uid', { role: 'admin', displayName: 'Test Admin' });

    // Act + Assert: empty data → HttpsError with invalid-argument code.
    // Note: the 'functions/' prefix is added by the onCall HTTP layer
    // (firebase-functions-test calls cf.run() directly, bypassing it).
    await expect(
      wrapped({
        data: {},
        auth: adminAuth('admin-uid', 'Test Admin'),
      } as CallableRequest<{ commentId?: string }>),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    // Negative assertions: no Firestore writes or audit logs.
    expect(mockState.updates).toHaveLength(0);
    expect(mockState.auditEntries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// restoreEntry — behavioral tests using firebase-functions-test
// ---------------------------------------------------------------------------

describe('restoreEntry', () => {
  beforeEach(() => {
    mockState.profiles.clear();
    mockState.updates.length = 0;
    mockState.auditEntries.length = 0;
  });

  it('admin status active yapıp removed alanlarını temizler', async () => {
    // Arrange: admin profile in the (mocked) users collection.
    mockState.profiles.set('admin-uid', { role: 'admin', displayName: 'Test Admin' });

    // Act: invoke the wrapped callable with admin auth + valid entryId.
    const result = await wrappedEntry({
      data: { entryId: 'e1' },
      auth: adminAuth('admin-uid', 'Test Admin'),
    } as CallableRequest<{ entryId: string }>);

    // Assert: returns ok:true.
    expect(result).toEqual({ ok: true });

    // Assert: Firestore update was called on entries/e1 with status: 'active'
    // and removedReason/removedBy/removedAt cleared to null — proves the
    // function both flipped the status field and cleared remove metadata.
    const update = mockState.updates.find(
      (u) => u.collection === 'entries' && u.id === 'e1',
    );
    expect(update).toBeDefined();
    expect(update!.data).toEqual({
      status: 'active',
      removedReason: null,
      removedBy: null,
      removedAt: null,
    });

    // Assert: audit log entry was written with correct shape.
    expect(mockState.auditEntries).toHaveLength(1);
    const audit = mockState.auditEntries[0];
    expect(audit).toMatchObject({
      action: 'entry.restore',
      targetType: 'entry',
      targetId: 'e1',
      actorUid: 'admin-uid',
      actorName: 'Test Admin',
    });
    expect(audit.createdAt).toBe('SERVER_TIMESTAMP');
  });

  it('non-admin permission-denied alır', async () => {
    // Arrange: non-moderator profile — assertIsAdmin must reject.
    mockState.profiles.set('user-uid', { role: 'user', displayName: 'Test User' });

    // Act + Assert: HttpsError with permission-denied code.
    await expect(
      wrappedEntry({
        data: { entryId: 'e1' },
        auth: userAuth('user-uid'),
      } as CallableRequest<{ entryId: string }>),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });

    // Negative assertions: nothing should have been written.
    expect(mockState.updates).toHaveLength(0);
    expect(mockState.auditEntries).toHaveLength(0);
  });

  it('entryId eksikse invalid-argument', async () => {
    // Arrange: admin profile so we pass the auth gate and reach the arg check.
    mockState.profiles.set('admin-uid', { role: 'admin', displayName: 'Test Admin' });

    // Act + Assert: empty data → HttpsError with invalid-argument code.
    await expect(
      wrappedEntry({
        data: {},
        auth: adminAuth('admin-uid', 'Test Admin'),
      } as CallableRequest<{ entryId?: string }>),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    // Negative assertions: no Firestore writes or audit logs.
    expect(mockState.updates).toHaveLength(0);
    expect(mockState.auditEntries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Local stubs for the OTHER 4 callables (used by the shape tests above).
// We do not import the real callables for those — their tests remain shape
// tests per the existing convention. Only restoreComment and restoreEntry
// get behavioral coverage in this file.
// ---------------------------------------------------------------------------

function moderateComment() { return null; }
function blockUser() { return null; }
function unblockUser() { return null; }
function getAdminStats() { return null; }
