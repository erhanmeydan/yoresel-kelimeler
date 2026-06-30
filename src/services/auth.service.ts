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
  try {
    const provider = new GoogleAuthProvider();
    provider.setDefaultLanguage('tr');
    provider.setCustomParameters({ prompt: 'select_account' });

    // Check for redirect result first (handles page reload after OAuth callback)
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) {
      await ensureUserProfile(db, redirectResult.user, redirectResult.user.displayName ?? 'Kullanıcı');
      return { ok: true, data: redirectResult.user };
    }

    // No redirect result → start new sign-in flow
    // Use signInWithRedirect (not signInWithPopup) — required for iOS Safari
    // where third-party cookie restrictions break popup-based Google OAuth.
    await signInWithRedirect(auth, provider);
    // signInWithRedirect throws — control never reaches here in normal flow.
    // If it does resolve, treat as success.
    return { ok: true, data: auth.currentUser! };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
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

export async function getProfile(db: Firestore, uid: string): Promise<ServiceResult<UserProfile | null>> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    return { ok: true, data: snap.exists() ? (snap.data() as UserProfile) : null };
  } catch {
    return { ok: false, error: { code: 'auth/profile-failed', message: 'Profil yüklenemedi.' } };
  }
}