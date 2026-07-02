/**
 * End-to-end test orchestrator.
 *
 * Spawns the Firebase auth + firestore emulators, builds the app,
 * serves it via `vite preview`, runs the headless Puppeteer tests, and
 * tears everything down. This is the only way the moderation / Google
 * sign-in tests should be invoked — running them directly against
 * production is explicitly refused by the production guards inside
 * those scripts.
 *
 * Steps:
 *   1. Start emulators (auth=9099, firestore=8080) and wait until ready.
 *   2. Build the app with VITE_USE_EMULATORS=true so it talks to the
 *      local emulators.
 *   3. Start `vite preview` and wait for it to serve the bundle.
 *   4. Run `scripts/create-test-admin.mjs` to provision the test user
 *      in the emulator.
 *   5. Run `scripts/test-moderation-headless.mjs`.
 *   6. (Optional) Run `scripts/test-google-signin.mjs` if SKIP_GOOGLE
 *      is not set.
 *   7. Tear down: stop vite preview, stop the emulators.
 *
 * Usage:
 *   node scripts/test-e2e.mjs
 *   SKIP_GOOGLE=1 node scripts/test-e2e.mjs
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

import { start as startEmulator, stop as stopEmulator } from './start-emulator.mjs';

const AUTH_PORT = 9099;
const FS_PORT = 8080;
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

const log = (...args) => console.log('[e2e]', ...args);
const fail = (msg, extra) => {
  console.error('[e2e] FAIL:', msg);
  if (extra) console.error('       ', extra);
  process.exit(1);
};

function runChild(cmd, args, opts = {}) {
  return new Promise((resolveP, rejectP) => {
    log('  $', cmd, args.join(' '));
    const child = spawn(cmd, args, {
      cwd: projectRoot,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', rejectP);
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await new Promise((resolveP, rejectP) => {
        const req = http.get(url, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) resolveP();
          else rejectP(new Error('status ' + res.statusCode));
        });
        req.on('error', rejectP);
        req.setTimeout(2000, () => req.destroy(new Error('timeout')));
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`server at ${url} did not become ready in ${timeoutMs}ms`);
}

async function main() {
  const emuEnv = {
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${AUTH_PORT}`,
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${FS_PORT}`,
    FIREBASE_EMULATOR_HUB: `127.0.0.1:4400`,
    GCLOUD_PROJECT: 'yoresel-kelimeler',
    FIREBASE_PROJECT_ID: 'yoresel-kelimeler',
  };

  // Make these env vars available to spawned children (npm run scripts,
  // vite build, create-test-admin, headless tests) by stashing them on
  // process.env and re-passing them through.
  for (const [k, v] of Object.entries(emuEnv)) {
    process.env[k] = v;
  }

  log('step 1: starting firebase emulators');
  await startEmulator({ timeoutMs: 60_000 });

  let preview;
  try {
    log('step 2: building app with VITE_USE_EMULATORS=true');
    await runChild('npm', ['run', 'build:web'], {
      env: { VITE_USE_EMULATORS: 'true', ...emuEnv },
    });

    log('step 3: starting vite preview on :' + PREVIEW_PORT);
    preview = spawn(
      'npx',
      ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
      {
        cwd: projectRoot,
        env: { ...process.env, VITE_USE_EMULATORS: 'true' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    preview.stdout.on('data', (chunk) => {
      if (process.env.E2E_VERBOSE) {
        process.stdout.write('[vite] ' + chunk.toString());
      }
    });
    preview.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (process.env.E2E_VERBOSE) {
        process.stderr.write('[vite] ' + text);
      } else if (text.toLowerCase().includes('error')) {
        process.stderr.write('[vite] ' + text);
      }
    });
    preview.on('exit', (code, signal) => {
      log('vite preview exited (code=' + code + ', signal=' + signal + ')');
    });
    await waitForServer(PREVIEW_URL);

    log('step 4: creating test admin in emulator');
    await runChild('node', ['scripts/create-test-admin.mjs'], { env: emuEnv });

    log('step 5: running moderation headless test');
    await runChild('node', ['scripts/test-moderation-headless.mjs'], {
      env: { ...emuEnv, MOD_TEST_URL: PREVIEW_URL },
    });

    if (!process.env.SKIP_GOOGLE) {
      log('step 6: running google sign-in test');
      await runChild('node', ['scripts/test-google-signin.mjs'], {
        env: { ...emuEnv, GOOGLE_TEST_URL: PREVIEW_URL },
      });
    } else {
      log('step 6: skipping google sign-in test (SKIP_GOOGLE set)');
    }

    log('ALL E2E STEPS COMPLETED');
  } finally {
    log('tearing down');
    if (preview && !preview.killed) {
      try {
        preview.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 1000));
      if (preview && !preview.killed) {
        try {
          preview.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }
    }
    await stopEmulator();
  }
}

main().catch((err) => {
  console.error('[e2e] FATAL:', err);
  process.exit(1);
});
