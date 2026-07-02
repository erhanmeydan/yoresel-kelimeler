import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, signInWithRedirect, GoogleAuthProvider,
  signOut as fbSignOut, onAuthStateChanged, updateProfile,
  getRedirectResult, type User, type Auth,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { UserProfile, ServiceResult } from '../types/models';

const errorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı.',
  'auth/invalid-email': 'Geçersiz e-posta adresi.',
  'auth/user-not-found': 'Bu e-postaya sahip bir hesap yok.',
  'auth/wrong-password': 'Hatalı şifre.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/too-many-requests': 'Çok fazla deneme. Lütfen sonra tekrar deneyin.',
  'auth/popup-closed-by-user': 'Giriş penceresi kapatıldı.',
  'auth/cancelled-popup-request': 'Giriş iptal edildi.',
  'auth/account-exists-with-different-credential': 'Bu e-posta farklı bir yöntemle kayıtlı.',
};

function mapAuthError(code: string): string {
  return errorMessages[code] ?? 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

async function ensureUserProfile(
  db: Firestore, user: User, fallbackDisplayName = 'Kullanıcı',
): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const profile = {
    uid: user.uid,
    displayName: user.displayName ?? fallbackDisplayName,
    email: user.email ?? '',
    role: 'user',
    contributionCount: 0,
    approvedCount: 0,
    removedCount: 0,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
}

export async function register(
  auth: Auth, db: Firestore, email: string, password: string, displayName: string,
): Promise<ServiceResult<UserProfile>> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const profile: Omit<UserProfile, 'createdAt' | 'lastActiveAt'> & { createdAt: unknown; lastActiveAt: unknown } = {
      uid: cred.user.uid,
      displayName,
      email,
      role: 'user',
      contributionCount: 0,
      approvedCount: 0,
      removedCount: 0,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    };
    await setDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), profile);
    return { ok: true, data: { ...profile, createdAt: null as never, lastActiveAt: null as never } };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    return { ok: false, error: { code, message: mapAuthError(code) } };
  }
}

export async function login(
  auth: Auth, email: string, password: string,
): Promise<ServiceResult<User>> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, data: cred.user };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    return { ok: false, error: { code, message: mapAuthError(code) } };
  }
}

export async function signInWithGoogle(
  auth: Auth, db: Firestore,
): Promise<ServiceResult<User>> {
  const provider = new GoogleAuthProvider();
  provider.setDefaultLanguage('tr');
  provider.setCustomParameters({ prompt: 'select_account' });

  // 1) On every entry, check whether we are returning from a redirect-based
  //    sign-in (signInWithRedirect navigates the full page; on reload we may
  //    be arriving back from the Google OAuth callback). This must run
  //    before we attempt any new popup so it can short-circuit.
  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      // eslint-disable-next-line no-console
      console.log('[auth] signInWithGoogle: redirect result restored', {
        uid: redirectResult.user.uid,
        email: redirectResult.user.email,
      });
      await ensureUserProfile(
        db,
        redirectResult.user,
        redirectResult.user.displayName ?? 'Kullanıcı',
      );
      return { ok: true, data: redirectResult.user };
    }
  } catch (err) {
    // getRedirectResult can itself fail (e.g. user dismissed the flow).
    // Log and fall through — we will attempt a fresh popup next.
    const code = (err as { code?: string }).code ?? 'unknown';
    // eslint-disable-next-line no-console
    console.warn('[auth] signInWithGoogle: getRedirectResult error', {
      code,
      message: (err as Error).message,
    });
  }

  // 2) Primary path: try signInWithPopup. Works on Chrome desktop and Safari
  //    desktop. Faster UX (no full-page navigation), and gives us a User in
  //    the same call site.
  try {
    const cred = await signInWithPopup(auth, provider);
    // eslint-disable-next-line no-console
    console.log('[auth] signInWithGoogle: popup success', {
      uid: cred.user.uid,
      email: cred.user.email,
    });
    await ensureUserProfile(db, cred.user, cred.user.displayName ?? 'Kullanıcı');
    return { ok: true, data: cred.user };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    // eslint-disable-next-line no-console
    console.warn('[auth] signInWithGoogle: popup failed', {
      code,
      message: (err as Error).message,
    });

    // 3) Fallback: if the popup was blocked, closed, or otherwise unavailable
    //    (covers iOS Safari and any browser where third-party cookies/popups
    //    are restricted), switch to a full-page redirect. This navigates the
    //    current tab to Google's OAuth page; the result is consumed the next
    //    time this function runs (step 1 above).
    const redirectCodes = new Set([
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment',
      'auth/web-storage-unsupported',
    ]);
    if (redirectCodes.has(code)) {
      try {
        // eslint-disable-next-line no-console
        console.log('[auth] signInWithGoogle: falling back to redirect');
        await signInWithRedirect(auth, provider);
        // signInWithRedirect navigates — control does not normally reach here.
        // If it does (e.g. an unusual env), currentUser may not yet be set.
        return { ok: true, data: auth.currentUser ?? (null as unknown as User) };
      } catch (redirectErr) {
        const redirectCode = (redirectErr as { code?: string }).code ?? 'unknown';
        // eslint-disable-next-line no-console
        console.error('[auth] signInWithGoogle: redirect fallback failed', {
          code: redirectCode,
          message: (redirectErr as Error).message,
        });
        return {
          ok: false,
          error: { code: redirectCode, message: mapAuthError(redirectCode) },
        };
      }
    }

    // Non-redirect-eligible error (e.g. network, configuration). Surface it.
    // eslint-disable-next-line no-console
    console.error('[auth] signInWithGoogle: non-fallback error', {
      code,
      message: (err as Error).message,
    });
    return { ok: false, error: { code, message: mapAuthError(code) } };
  }
}

export async function logout(auth: Auth): Promise<ServiceResult<null>> {
  try {
    await fbSignOut(auth);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'auth/logout-failed', message: 'Çıkış yapılamadı.' } };
  }
}

export function observeAuth(auth: Auth, callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Resolves with the current Firebase Auth user AFTER auth state is fully
 * restored. Because the app calls `setPersistence(browserLocalPersistence)`
 * (src/config/firebase.ts), `auth.currentUser` is `null` on a fresh page
 * load until the SDK finishes restoring the persisted session. Reading
 * `auth.currentUser` synchronously inside a page renderer therefore races
 * the restore and almost always captures `null`, even for signed-in users.
 *
 * `onAuthStateChanged` fires immediately upon subscription with the
 * current (or restored) user, so awaiting one callback gives us a value
 * we can trust. If `auth.currentUser` is already set (warm navigation
 * inside the SPA), we resolve synchronously without subscribing.
 */
export function ensureAuthReady(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function getProfile(db: Firestore, uid: string): Promise<ServiceResult<UserProfile | null>> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    return { ok: true, data: snap.exists() ? (snap.data() as UserProfile) : null };
  } catch {
    return { ok: false, error: { code: 'auth/profile-failed', message: 'Profil yüklenemedi.' } };
  }
}