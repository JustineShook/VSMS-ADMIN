import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const configurationError = Object.values(config).some(value => !value)
  ? 'Firebase configuration is missing. Copy .env.example to .env.local and restart the development server.'
  : config.projectId !== 'veresc-16c53'
    ? 'This application must connect to Firebase project veresc-16c53. Check .env.local.'
    : null;

const app = configurationError ? null : initializeApp(config);
export const auth = app ? getAuth(app) : null;
// Load Firestore only when a future data service needs it.
// Authentication itself performs no Firestore reads or writes.
export async function getDb() {
  if (!app) throw new Error('Firebase is not configured.');
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(app);
}
