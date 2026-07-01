/**
 * Headless browser test for the Google sign-in flow on production.
 *
 * Verifies the user-reported bug: "Google login çalışmıyor".
 *
 * Flow:
 *   1. Launch headless Chrome with a persistent user-data-dir.
 *   2. Navigate to https://yoresel-kelimeler.web.app.
 *   3. Click "Giriş Yap" to open the auth drawer.
 *   4. Click the "Google ile devam et" button (.btn-google).
 *   5. Capture every URL change as the OAuth redirect chain plays out
 *      (Firebase → accounts.google.com → callback).
 *   6. Capture every console message and every failed network request.
 *   7. After the redirect completes, check whether the auth state was
 *      restored (profile button rendered) or whether an error is shown.
 *
 * Because we don't have credentials for erhanmeydan@me.com here, the test
 * cannot actually complete the OAuth consent screen — but it WILL catch:
 *   - "redirect_uri_mismatch" errors shown on accounts.google.com
 *   - Third-party-cookie blocking in headless Chrome
 *   - Network failures during the OAuth handshake
 *   - Missing/incorrect Firebase Auth domain configuration
 *   - Auth state not being restored after the redirect
 *
 * Run with:
 *   node scripts/test-google-signin.mjs
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const puppeteer = require(resolve(projectRoot, 'node_modules/puppeteer'));

const TARGET = process.env.GOOGLE_TEST_URL ?? 'https://yoresel-kelimeler.web.app';
const SCREENSHOT_DIR = resolve(projectRoot, 'screenshots');

function log(...args) {
  console.log('[google-test]', ...args);
}

async function shoot(page, name) {
  const path = resolve(SCREENSHOT_DIR, `google-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  log('  screenshot:', path);
}

async function run() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  log('target:', TARGET);
  log('launching headless chrome');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Set a realistic UA so Google's OAuth page doesn't bail.
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  );

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const allRequests = [];
  const urlChanges = [];
  const redirectChain = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      consoleErrors.push({ type, text: text.slice(0, 500) });
    }
    // Log everything for completeness
    log(`  console.${type}:`, text.slice(0, 200));
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    log('  page-error:', err.message.slice(0, 300));
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    const failure = req.failure();
    failedRequests.push({
      url,
      method: req.method(),
      errorText: failure?.errorText ?? 'unknown',
      resourceType: req.resourceType(),
    });
    log('  request-failed:', req.method(), url, '-', failure?.errorText);
  });

  page.on('response', (res) => {
    const url = res.url();
    const status = res.status();
    const req = res.request();
    allRequests.push({
      url,
      method: req.method(),
      status,
      resourceType: req.resourceType(),
    });
    // Track OAuth-related responses
    if (
      url.includes('accounts.google.com') ||
      url.includes('firebaseapp.com/__/auth/') ||
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('securetoken.googleapis.com')
    ) {
      log(`  response ${status} [${req.resourceType()}]`, url.slice(0, 200));
    }
  });

  // Track every frame navigation. Puppeteer's `framenavigated` fires for both
  // top-level and sub-frame navigations.
  page.on('framenavigated', (frame) => {
    const url = frame.url();
    urlChanges.push({ url, time: Date.now() });
    if (frame === page.mainFrame()) {
      log('  navigation →', url);
      // Capture the redirect chain leading to/from Google.
      if (
        url.includes('accounts.google.com') ||
        url.includes('__/auth/handler') ||
        url.includes('yoresel-kelimeler')
      ) {
        redirectChain.push(url);
      }
    }
  });

  // 1. Open the home page.
  log('opening', TARGET);
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2000));
  await shoot(page, '01-loaded');

  // 2. Click "Giriş Yap" to open the auth drawer.
  log('opening auth drawer');
  const loginBtn = await page.$('#login-btn');
  if (!loginBtn) {
    log('  ! #login-btn not found. Page state:');
    log('    title:', await page.title());
    log('    url:', page.url());
    await shoot(page, 'no-login-btn');
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    log('    body[:500]:', bodyText);
    await browser.close();
    process.exit(1);
  }
  await loginBtn.click();
  await new Promise((r) => setTimeout(r, 800));
  await shoot(page, '02-drawer-open');

  // 3. Verify the Google button is present.
  const googleBtn = await page.$('.btn-google');
  if (!googleBtn) {
    log('  ! .btn-google not found.');
    await shoot(page, 'no-google-btn');
    await browser.close();
    process.exit(1);
  }
  log('Google button found.');

  // 4. Click the Google button. This triggers signInWithRedirect, which
  //    navigates the entire page to accounts.google.com.
  log('clicking Google button');
  await googleBtn.click();

  // 5. Wait for the redirect chain to play out. The page navigates away
  //    to accounts.google.com and then back to the app's __/auth/handler.
  //    In headless mode without cookies, Google will show the consent screen
  //    OR — if the domain is misconfigured — a redirect_uri_mismatch page.
  log('waiting for redirect chain...');

  // Wait up to 30s for navigation to either:
  //   - accounts.google.com (OAuth consent started)
  //   - OR back to the app (redirect completed, with or without error)
  let sawGoogle = false;
  let sawReturn = false;
  const start = Date.now();
  while (Date.now() - start < 30000) {
    const url = page.url();
    if (url.includes('accounts.google.com')) sawGoogle = true;
    // Once we've gone to Google and come back to yoresel-kelimeler, we're done.
    if (sawGoogle && url.includes('yoresel-kelimeler')) {
      sawReturn = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  log('sawGoogle:', sawGoogle, 'sawReturn:', sawReturn);

  await new Promise((r) => setTimeout(r, 2000));
  await shoot(page, '03-after-redirect');

  const finalUrl = page.url();
  log('final URL:', finalUrl);

  // 6. Check final page state.
  const finalState = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      hasProfileButton: !!document.querySelector('.profile-button'),
      hasLoginBtn: !!document.querySelector('#login-btn'),
      drawerOpen: !!document.querySelector('.drawer-backdrop'),
      authErrorText: document.querySelector('.auth-error')?.textContent?.trim() ?? null,
      authErrorHidden: document.querySelector('.auth-error')?.hidden ?? null,
      bodyHasGoogleError: document.body.innerText.includes('redirect_uri_mismatch') ||
        document.body.innerText.includes('400') ||
        document.body.innerText.includes('disallowed_useragent') ||
        document.body.innerText.includes('unauthorized_client'),
      bodySnippet: document.body.innerText.slice(0, 1500),
    };
  });

  log('final page state:');
  log('  url:', finalState.url);
  log('  title:', finalState.title);
  log('  hasProfileButton:', finalState.hasProfileButton);
  log('  hasLoginBtn:', finalState.hasLoginBtn);
  log('  drawerOpen:', finalState.drawerOpen);
  log('  authErrorText:', JSON.stringify(finalState.authErrorText));
  log('  bodyHasGoogleError:', finalState.bodyHasGoogleError);
  log('  body[:500]:', finalState.bodySnippet.slice(0, 500));

  await shoot(page, '04-final-state');

  // 7. Summary
  const summary = {
    target: TARGET,
    sawGoogle,
    sawReturn,
    finalUrl,
    finalTitle: finalState.title,
    authRestored: finalState.hasProfileButton,
    bodyHasOAuthError: finalState.bodyHasGoogleError,
    authErrorText: finalState.authErrorText,
    redirectChain,
    urlChanges: urlChanges.slice(-30),
    consoleErrors: consoleErrors.slice(0, 50),
    pageErrors: pageErrors.slice(0, 50),
    failedRequests: failedRequests.slice(0, 50),
    googleRelatedRequests: allRequests.filter((r) =>
      r.url.includes('accounts.google.com') ||
      r.url.includes('__/auth/') ||
      r.url.includes('identitytoolkit') ||
      r.url.includes('securetoken'),
    ),
  };

  log('--- SUMMARY ---');
  log(JSON.stringify(summary, null, 2));

  writeFileSync(
    resolve(SCREENSHOT_DIR, 'google-test-result.json'),
    JSON.stringify(summary, null, 2),
  );

  await browser.close();
}

run().catch((err) => {
  console.error('[google-test] FATAL:', err);
  process.exit(1);
});