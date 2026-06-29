import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
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
export const db: Firestore = getFirestore(app);

const useEmulators =
  (import.meta.env.VITE_USE_EMULATORS ?? firebaseConfig.useEmulators) === 'true';
if (useEmulators) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}