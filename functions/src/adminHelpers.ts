import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

export interface UserRole {
  uid: string;
  role: string;
  displayName: string;
}

/**
 * Fetch a user's profile from Firestore.
 * Returns null if the user doesn't have a profile doc yet.
 */
export async function getProfile(uid: string): Promise<UserRole | null> {
  const doc = await getFirestore().doc(`users/${uid}`).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    uid,
    role: data.role ?? 'user',
    displayName: data.displayName ?? 'Kullanıcı',
  };
}

/**
 * Asserts the request is from an authenticated user with moderator or admin role.
 * Throws HttpsError on failure.
 */
export async function assertIsAdmin(req: { auth?: { uid: string } }): Promise<UserRole> {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Giriş yapmalısın.');
  }
  const profile = await getProfile(req.auth.uid);
  if (!profile || !['moderator', 'admin'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'Yönetici yetkisi gerekli.');
  }
  return profile;
}

export async function writeAuditLog(entry: Record<string, unknown>): Promise<void> {
  await getFirestore().collection('auditLog').add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function incrementCounter(key: string, delta = 1): Promise<void> {
  await getFirestore().collection('counters').doc('adminStats').set(
    { [key]: FieldValue.increment(delta) },
    { merge: true },
  );
}

export async function getCounters(keys: string[]): Promise<Record<string, number>> {
  const doc = await getFirestore().collection('counters').doc('adminStats').get();
  const data = doc.exists ? doc.data()! : {};
  return Object.fromEntries(
    keys.map((k) => [k, data[k] ?? 0]),
  );
}
