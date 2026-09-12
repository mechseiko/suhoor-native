import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID,
} from '@env';

/**
 * Firebase for the mobile app.
 *
 * Values arrive through the virtual `@env` module (react-native-dotenv, wired up
 * in babel.config.js). They used to be read as `process.env.EXPO_PUBLIC_*`, which
 * Metro does not inline in a bare React Native app — so all six were `undefined`
 * and `initializeApp` built a config with no project. Auth then failed on launch
 * with an opaque error.
 *
 * The `EXPO_PUBLIC_` prefix is a leftover from an earlier Expo setup and carries
 * no meaning here; it is kept only so the existing .env keeps working.
 */

const firebaseConfig = {
  apiKey: EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Fail loudly and specifically. Firebase's own error for an empty config
// ("auth/invalid-api-key") gives no hint that the cause is a missing .env, and
// this app's whole session state depends on auth working.
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length) {
  console.error(
    `[suhoor] Firebase config is incomplete — missing: ${missingKeys.join(', ')}.\n` +
      'Check suhoor-native/.env, then restart Metro with `npm start -- --reset-cache` ' +
      '(react-native-dotenv inlines .env at build time, so a plain reload keeps the old values).'
  );
}

const app = initializeApp(firebaseConfig);

// Set up auth with React Native persistence using AsyncStorage
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
