/**
 * Headless browser test for the /moderation page.
 *
 * Verifies the actual user-reported bug: signed-in admin/moderator users
 * were seeing "Yetkisiz. Giriş yapın." on /moderation. The fix uses
 * ensureAuthReady() in src/services/auth.service.ts to wait for Firebase
 * Auth to finish restoring the persisted session before checking auth.
 *
 * This version of the test runs ENTIRELY against the Firebase emulator
 * suite and a local `vite preview` build — it MUST NOT touch production.
 * The previous version pointed at https://yoresel-kelimeler.web.app and
 * accidentally created a "PENTEST" user in production Firebase. See PR
 * for the migration story.
 *
 * Flow:
 *   1. Production guard: refuse to run if target is the production host
 *      and emulator env vars are not set.
 *   2. Read test credentials from scripts/.test-admin.json (created by
 *      create-test-admin.mjs, which itself only writes to the emulator).
 *   3. Wait for the local app server.
 *   4. Launch headless Chrome, open the app, sign in via the auth drawer.
 *   5. Navigate to /moderation and assert the panel renders.
 *
 * Run via the npm script (recommended — handles emulator lifecycle):
 *   npm run test:moderation
 *
 * Or manually with emulators already running:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   MOD_TEST_URL=http://localhost:4173 \
 *   node scripts/test-moderation-headless.mjs
 */

import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const puppeteer = require(resolve(projectRoot, 'node_modules/puppeteer'));

const TARGET_BASE = process.env.MOD_TEST_URL ?? 'http://localhost:4173';
const TARGET_MOD = `${TARGET_BASE.replace(/\/$/, '')}/moderation`;
const SCREENSHOT_DIR = resolve(projectRoot, 'screenshots');

const PROD_HOSTS = [
  'yoresel-kelimeler.web.app',
  'yoresel-kelimeler.firebaseapp.com',
];

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------
const isProdHost = PROD_HOSTS.some((h) => TARGET_BASE.includes(h));
const emuActive =
  Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) &&
  Boolean(process.env.FIRESTORE_EMULATOR_HOST);

if (isProdHost) {
  console.error(
    '[mod-test] ❌ REFUSING: target ' +
      TARGET_BASE +
      ' is production. Set MOD_TEST_URL to a local preview server ' +
      '(e.g. http://localhost:4173) and run against emulators.',
  );
  process.exit(1);
}
if (!emuActive) {
  console.error(
    '[mod-test] ❌ REFUSING: emulator env vars are not set.\n' +
      '   Start the emulators first (npm run emulators) or use `npm run test:moderation` ' +
      'which orchestrates emulator + test.',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Test credentials
// ---------------------------------------------------------------------------
function loadCreds() {
  const credPath = resolve(projectRoot, 'scripts/.test-admin.json');
  if (process.env.TEST_MOD_EMAIL && process.env.TEST_MOD_PASSWORD) {
    return {
      email: process.env.TEST_MOD_EMAIL,
      password: process.env.TEST_MOD_PASSWORD,
      uid: process.env.TEST_MOD_UID ?? null,
    };
  }
  if (!existsSync(credPath)) {
    console.error(
      '[mod-test] ❌ No credentials. Either:\n' +
        '   - Run `npm run test:moderation:setup` first to create scripts/.test-admin.json, OR\n' +
        '   - Set TEST_MOD_EMAIL and TEST_MOD_PASSWORD env vars.',
    );
    process.exit(1);
  }
  const c = JSON.parse(readFileSync(credPath, 'utf-8'));
  if (!c.email || !c.password) {
    console.error('[mod-test] ❌ Malformed .test-admin.json — missing email/password');
    process.exit(1);
  }
  return c;
}

const TEST_EMAIL = loadCreds().email;
const TEST_PASSWORD = loadCreds().password;

function log(...args) {
  console.log('[mod-test]', ...args);
}

function fail(msg, extra) {
  console.error('[mod-test] FAIL:', msg);
  if (extra) console.error('[mod-test]       ', extra);
  process.exit(1);
}

async function waitForServer(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      await new Promise((resolveP, rejectP) => {
        const req = http.get(url, (res) => {
          res.resume();
          resolveP();
        });
        req.on('error', rejectP);
        req.setTimeout(1000, () => req.destroy(new Error('timeout')));
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`server at ${url} not responding after ${attempts}s`);
}

async function shoot(page, name) {
  const path = resolve(SCREENSHOT_DIR, `moderation-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  log('  screenshot:', path);
}

async function assertNoYetkisiz(page) {
  const body = await page.evaluate(() => document.body.innerText);
  if (/Yetkisiz\. Giriş yapın/.test(body)) {
    await shoot(page, 'still-fails');
    fail('page still shows "Yetkisiz. Giriş yapın." — fix did not work.');
  }
}

async function run() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  log('target base:', TARGET_BASE);
  log('target mod :', TARGET_MOD);
  log('auth emu   :', process.env.FIREBASE_AUTH_EMULATOR_HOST);
  log('fs emu     :', process.env.FIRESTORE_EMULATOR_HOST);
  log('user       :', TEST_EMAIL);
  await waitForServer(TARGET_BASE);

  log('launching headless chrome');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') {
      log('  page-console:', t, msg.text().slice(0, 200));
    }
  });
  page.on('pageerror', (err) => {
    log('  page-error:', err.message.slice(0, 200));
  });

  // 1. Open home page so the auth drawer can be triggered.
  log('opening', TARGET_BASE);
  await page.goto(TARGET_BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));

  // 2. Click "Giriş Yap" button in header to open auth drawer.
  log('opening auth drawer');
  await page.waitForSelector('#login-btn', { timeout: 10000 });
  await page.click('#login-btn');
  await new Promise((r) => setTimeout(r, 500));

  // 3. Fill in email and password, submit.
  log('signing in as', TEST_EMAIL);
  await page.waitForSelector('input[name="email"]', { timeout: 5000 });
  await page.type('input[name="email"]', TEST_EMAIL, { delay: 20 });
  await page.type('input[name="password"]', TEST_PASSWORD, { delay: 20 });
  await shoot(page, 'login-form');

  await page.click('button.auth-submit');

  // 4. Wait for auth state to settle (auth.currentUser populates, drawer closes).
  log('waiting for auth state...');
  await page.waitForFunction(() => {
    return document.querySelector('.profile-button') !== null;
  }, { timeout: 15000 });
  log('auth state detected (profile button rendered)');
  await new Promise((r) => setTimeout(r, 500));
  await shoot(page, 'after-login');

  // 5. Navigate to /moderation via direct URL (most realistic — refresh case).
  log('navigating to /moderation');
  await page.goto(TARGET_MOD, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await shoot(page, 'moderation-arrived');

  // 6. Assert "Moderasyon Paneli" heading visible.
  const heading = await page.evaluate(() => {
    const h = document.querySelector('h2, h1');
    return h?.textContent?.trim() ?? null;
  });
  log('  heading text:', JSON.stringify(heading));
  if (heading !== 'Moderasyon Paneli') {
    await shoot(page, 'wrong-heading');
    await assertNoYetkisiz(page);
    fail(`expected heading "Moderasyon Paneli", got ${JSON.stringify(heading)}`);
  }
  log('  PASS: heading "Moderasyon Paneli" present');

  // 7. Assert 4 tab buttons.
  const tabLabels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.tab-btn')).map(
      (b) => b.textContent?.trim() ?? '',
    );
  });
  log('  tab labels:', tabLabels);
  const expectedTabs = ['Raporlar', 'Yorumlar', 'Kullanıcılar', 'İstatistikler'];
  if (tabLabels.length !== 4) {
    fail(`expected 4 tab buttons, got ${tabLabels.length}: ${JSON.stringify(tabLabels)}`);
  }
  for (const expected of expectedTabs) {
    if (!tabLabels.includes(expected)) {
      fail(`missing tab "${expected}". Found: ${JSON.stringify(tabLabels)}`);
    }
  }
  log('  PASS: 4 expected tab buttons present');

  // 8. Click Yorumlar tab and assert content loads.
  log('clicking Yorumlar tab');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.tab-btn'))
      .find((b) => b.textContent?.trim() === 'Yorumlar');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  await shoot(page, 'yorumlar-tab');

  const tabHeading = await page.evaluate(() => {
    const h = document.querySelector('h2, h1');
    return h?.textContent?.trim() ?? null;
  });
  if (tabHeading !== 'Moderasyon Paneli') {
    fail(`heading changed unexpectedly after tab switch: ${JSON.stringify(tabHeading)}`);
  }
  await assertNoYetkisiz(page);
  log('  PASS: Yorumlar tab content rendered without "Yetkisiz"');

  log('ALL ASSERTIONS PASSED');
  await shoot(page, 'final-success');

  const summary = {
    ok: true,
    target: TARGET_MOD,
    heading: heading,
    tabs: tabLabels,
    screenshot: resolve(SCREENSHOT_DIR, 'moderation-final-success.png'),
  };
  writeFileSync(
    resolve(SCREENSHOT_DIR, 'moderation-test-result.json'),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
