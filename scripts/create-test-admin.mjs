/**
 * Creates a test admin user against the Firebase EMULATOR (not production)
 * and writes the credentials to scripts/.test-admin.json. Run once before
 * the headless moderation test.
 *
 * This script MUST NOT run against production. The production guard at
 * the top of the file refuses to run unless FIREBASE_AUTH_EMULATOR_HOST
 * and FIRESTORE_EMULATOR_HOST are set. The `test:e2e` orchestrator sets
 * these automatically.
 *
 * Usage:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   node scripts/create-test-admin.mjs
 *
 * Or via the npm script (which sets the env vars and starts emulators):
 *   npm run test:moderation:setup
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------
// If we're being run in a way that would touch production, bail out loudly.
// `FIREBASE_EMULATOR_HUB` is set by `firebase emulators:exec`. We require
// either that, or both emulator host env vars, to be set.
const emulatorHub = process.env.FIREBASE_EMULATOR_HUB;
const authEmu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const fsEmu = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulatorHub && (!authEmu || !fsEmu)) {
  console.error(
    '❌ This script must NOT run against production.\n' +
    '   Set FIREBASE_EMULATOR_HUB (e.g. by running under `firebase emulators:exec`)\n' +
    '   or set both FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST.\n' +
    '   Use: npm run test:moderation:setup',
  );
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !emulatorHub) {
  console.error(
    '❌ NODE_ENV=production detected. Refusing to run without FIREBASE_EMULATOR_HUB.',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TEST_EMAIL = process.env.TEST_MOD_EMAIL ?? 'test-mod@yoresel-kelimeler.test';
const TEST_PASSWORD = process.env.TEST_MOD_PASSWORD ?? 'TestModPass123!';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'yoresel-kelimeler';
const OUT_PATH = resolve(projectRoot, 'scripts/.test-admin.json');

console.log('[create-test-admin] project :', PROJECT_ID);
console.log('[create-test-admin] auth emu:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
console.log('[create-test-admin] fs emu  :', process.env.FIRESTORE_EMULATOR_HOST);
console.log('[create-test-admin] hub     :', process.env.FIREBASE_EMULATOR_HUB ?? '(none)');
console.log('[create-test-admin] email   :', TEST_EMAIL);

// ---------------------------------------------------------------------------
// Service account
// ---------------------------------------------------------------------------
// The admin SDK requires credentials to talk to the Auth/Firestore emulators.
// We can either use the real service account (the emulator does not validate
// it) or any dummy credentials. Reuse the project's service account if
// present; otherwise synthesize a throwaway one.
let credential;
const saPath = resolve(projectRoot, 'service-account.json');
if (existsSync(saPath)) {
  console.log('[create-test-admin] using service-account.json');
  const serviceAccount = JSON.parse(readFileSync(saPath, 'utf-8'));
  credential = (await import('firebase-admin/app')).cert(serviceAccount);
} else {
  console.log('[create-test-admin] no service-account.json — using emulator dummy credentials');
  // The Auth/Firestore emulators accept any project ID + any credential;
  // we still need to provide something so the SDK doesn't try to use ADC.
  credential = {
    getAccessToken: async () => ({ access_token: 'owner', expires_in: 1_000_000 }),
  };
}

const admin = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

admin.initializeApp({
  credential,
  projectId: PROJECT_ID,
});

const auth = getAuth();
const db = getFirestore();

// ---------------------------------------------------------------------------
// Create or update user
// ---------------------------------------------------------------------------
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

// Force the password to the expected value (idempotent).
await auth.updateUser(userRecord.uid, { password: TEST_PASSWORD });

// Promote to admin role in Firestore.
await db.doc(`users/${userRecord.uid}`).set(
  {
    uid: userRecord.uid,
    displayName: 'Test Moderator',
    email: TEST_EMAIL,
    role: 'admin',
    contributionCount: 0,
    approvedCount: 0,
    removedCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    lastActiveAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);
console.log('[create-test-admin] role set to admin');

// ---------------------------------------------------------------------------
// Persist credentials for the test runner
// ---------------------------------------------------------------------------
writeFileSync(
  OUT_PATH,
  JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, uid: userRecord.uid }, null, 2),
);
console.log('[create-test-admin] wrote', OUT_PATH);
console.log('[create-test-admin] done.');
process.exit(0);
