/**
 * Spawns the Firebase emulators (auth + firestore) as a child process and
 * returns a cleanup function. The script reads the emulator ports from
 * firebase.json, polls the Auth and Firestore emulator HTTP endpoints, and
 * resolves once both are healthy.
 *
 * Usage:
 *   const { start, stop } = await import('./start-emulator.mjs');
 *   await start();        // spawns emulators, waits for ready
 *   // ... run tests against the emulators ...
 *   await stop();         // kills the child process
 *
 * Environment variables respected:
 *   FIREBASE_PROJECT_ID     — defaults to the project from .firebaserc
 *   EMULATOR_KEEP_ALIVE     — if set, the child is not killed on stop()
 *                              (useful for `firebase emulators:exec` mode)
 *   EMULATOR_LOG_FILE       — write child stdout/stderr to this file
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const log = (...args) => console.log('[emulator]', ...args);
const warn = (...args) => console.warn('[emulator]', ...args);

function readPorts() {
  const cfg = JSON.parse(readFileSync(resolve(projectRoot, 'firebase.json'), 'utf-8'));
  const auth = cfg?.emulators?.auth?.port ?? 9099;
  const firestore = cfg?.emulators?.firestore?.port ?? 8080;
  return { auth, firestore };
}

function readProjectId() {
  try {
    const rc = JSON.parse(readFileSync(resolve(projectRoot, '.firebaserc'), 'utf-8'));
    return rc?.projects?.default ?? process.env.FIREBASE_PROJECT_ID ?? 'demo-test';
  } catch {
    return process.env.FIREBASE_PROJECT_ID ?? 'demo-test';
  }
}

function probe(port, path = '/') {
  return new Promise((resolveP, rejectP) => {
    const req = http.get(
      { host: '127.0.0.1', port, path, timeout: 1500 },
      (res) => {
        res.resume();
        // Auth emulator returns 400 on /, Firestore returns 404 on / — both
        // are valid "the server is up" signals. Treat any response (even
        // 4xx) as success.
        resolveP(res.statusCode);
      },
    );
    req.on('timeout', () => req.destroy(new Error('probe timeout')));
    req.on('error', rejectP);
  });
}

async function waitForReady(ports, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let authOk = false;
  let fsOk = false;
  // Firestore emulator exposes a /v1/projects/{project}/databases/(default)/documents
  // endpoint but the simplest probe is the root — a 404 is fine.
  while (Date.now() < deadline) {
    if (!authOk) {
      try {
        await probe(ports.auth);
        authOk = true;
        log('auth emulator ready on :' + ports.auth);
      } catch {
        /* still booting */
      }
    }
    if (!fsOk) {
      try {
        await probe(ports.firestore);
        fsOk = true;
        log('firestore emulator ready on :' + ports.firestore);
      } catch {
        /* still booting */
      }
    }
    if (authOk && fsOk) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `emulator did not become ready within ${timeoutMs}ms ` +
    `(auth=${authOk}, firestore=${fsOk})`,
  );
}

let child = null;

export async function start(options = {}) {
  if (child) {
    log('emulator already running (pid', child.pid, ')');
    return { stop };
  }
  const ports = readPorts();
  const projectId = options.projectId ?? readProjectId();
  log('starting firebase emulators (project=' + projectId + ')');

  const args = [
    'emulators:start',
    '--only',
    'auth,firestore',
    '--project',
    projectId,
  ];
  const cmd = options.firebaseBin ?? 'firebase';

  child = spawn(cmd, args, {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    if (process.env.EMULATOR_VERBOSE === 'true') {
      process.stdout.write('[emulator:out] ' + text);
    }
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    // Firebase CLI prints its progress on stderr.
    if (process.env.EMULATOR_VERBOSE === 'true') {
      process.stderr.write('[emulator:err] ' + text);
    } else {
      // Show only key milestone lines.
      for (const line of text.split('\n')) {
        if (
          line.includes('All emulators ready') ||
          line.includes('Error') ||
          line.includes('EADDRINUSE')
        ) {
          log(line.trim());
        }
      }
    }
  });
  child.on('exit', (code, signal) => {
    warn('emulator process exited (code=' + code + ', signal=' + signal + ')');
    child = null;
  });

  await waitForReady(ports, options.timeoutMs ?? 60_000);
  log('emulator ready (auth=' + ports.auth + ', firestore=' + ports.firestore + ')');
  return { stop };
}

export async function stop() {
  if (!child) return;
  if (process.env.EMULATOR_KEEP_ALIVE) {
    log('EMULATOR_KEEP_ALIVE set — not killing child pid', child.pid);
    return;
  }
  log('killing emulator child pid', child.pid);
  try {
    child.kill('SIGTERM');
  } catch (err) {
    warn('kill failed:', err.message);
  }
  // Give it a moment, then SIGKILL.
  await new Promise((r) => setTimeout(r, 1500));
  if (child) {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already dead */
    }
  }
  child = null;
}

// Allow `node scripts/start-emulator.mjs` for manual debugging.
if (import.meta.url === `file://${process.argv[1]}`) {
  start()
    .then(() => {
      log('ready. Press Ctrl+C to stop.');
      process.on('SIGINT', () => {
        stop().then(() => process.exit(0));
      });
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
