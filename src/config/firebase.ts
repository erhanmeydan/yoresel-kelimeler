import { initializeApp, type FirebaseApp } from 'firebase/app';
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
export const auth: Auth = getAuth(app);
// LOCAL persistence: user session persists across page reloads and tabs
// Critical fix: prevents auth state loss when user refreshes or navigates away
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[firebase] setPersistence failed:', err);
});
export const db: Firestore = getFirestore(app);

const useEmulators =
  (import.meta.env.VITE_USE_EMULATORS ?? firebaseConfig.useEmulators) === 'true';
if (useEmulators) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}