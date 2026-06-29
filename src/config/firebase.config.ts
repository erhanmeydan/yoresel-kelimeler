// Production Firebase client config (public — values meant to be in browser bundle).
// Local override: .env.local with VITE_FIREBASE_* keys (gitignored).
export const firebaseConfig = {
  apiKey: 'AIzaSyCKQPLZ1uydTj7EehzWwNt11vr94HByCwM',
  authDomain: 'yoresel-kelimeler.firebaseapp.com',
  projectId: 'yoresel-kelimeler',
  storageBucket: 'yoresel-kelimeler.firebasestorage.app',
  messagingSenderId: '893173885395',
  appId: '1:893173885395:web:e70771b69b72ee5b6da726',
  useEmulators: false,
} as const;