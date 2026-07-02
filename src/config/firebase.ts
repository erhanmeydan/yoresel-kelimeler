import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase.config';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? firebaseConfig.appId,
};

export const app: FirebaseApp = initializeApp(config);

const useEmulators =
  (import.meta.env.VITE_USE_EMULATORS ?? firebaseConfig.useEmulators) === 'true';

// App Check (#4): blocks direct-REST abuse (bulk likes/spam) by attesting that
// requests come from the real app. Initialized only when a reCAPTCHA v3 site key
// is configured and we are not on the emulators. Console must also *enforce*
// App Check for Firestore + Functions for this to take effect.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
if (recaptchaSiteKey && !useEmulators) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth: Auth = getAuth(app);
// LOCAL persistence: user session persists across page reloads and tabs
// Critical fix: prevents auth state loss when user refreshes or navigates away
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[firebase] setPersistence failed:', err);
});
export const db: Firestore = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
