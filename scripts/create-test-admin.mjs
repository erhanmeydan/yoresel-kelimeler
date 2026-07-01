/**
 * Creates a test admin user in the Firebase project and writes the
 * credentials to scripts/.test-admin.json. Run once before the headless
 * test. Safe to delete the user afterward via the Firebase Console.
 *
 * Usage:
 *   node scripts/create-test-admin.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const TEST_EMAIL = process.env.TEST_MOD_EMAIL ?? 'test-mod@yoresel-kelimeler.test';
const TEST_PASSWORD = process.env.TEST_MOD_PASSWORD ?? 'TestModPass123!';
const OUT_PATH = resolve(projectRoot, 'scripts/.test-admin.json');

const serviceAccount = JSON.parse(
  readFileSync(resolve(projectRoot, 'service-account.json'), 'utf-8'),
);

const admin = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore } = await import('firebase-admin/firestore');

admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

const auth = getAuth();
const db = getFirestore();

console.log('[create-test-admin] email:', TEST_EMAIL);

// Get or create the user.
let userRecord;
try {
  userRecord = await auth.getUserByEmail(TEST_EMAIL);
  console.log('[create-test-admin] user already exists:', userRecord.uid);
} catch (err) {
  if (err.code === 'auth/user-not-found') {
    userRecord = await auth.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: 'Test Moderator',
    });
    console.log('[create-test-admin] created user:', userRecord.uid);
  } else {
    throw err;
  }
}

// Set the user password (in case it was different) and force admin role.
await auth.updateUser(userRecord.uid, { password: TEST_PASSWORD });
await db.doc(`users/${userRecord.uid}`).set({
  uid: userRecord.uid,
  displayName: 'Test Moderator',
  email: TEST_EMAIL,
  role: 'admin',
  contributionCount: 0,
  approvedCount: 0,
  removedCount: 0,
  createdAt: new Date(),
  lastActiveAt: new Date(),
}, { merge: true });
console.log('[create-test-admin] role set to admin');

writeFileSync(OUT_PATH, JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, uid: userRecord.uid }, null, 2));
console.log('[create-test-admin] wrote', OUT_PATH);
console.log('[create-test-admin] done.');
process.exit(0);
