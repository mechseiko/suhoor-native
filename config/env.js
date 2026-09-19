import { EXPO_PUBLIC_SOCKET_URL, ISLAMIC_API_KEY as ENV_ISLAMIC_API_KEY } from '@env';

/**
 * External configuration for the mobile app.
 *
 * Values come from `.env` through the virtual `@env` module (react-native-dotenv,
 * configured in babel.config.js). This is the single place these live —
 * previously the fasting-times key was pasted into two source files.
 *
 * A key compiled into a mobile bundle is extractable from the APK no matter where
 * it sits in the source. Restrict it at the provider, and proxy anything that
 * must stay secret through the app's own server.
 *
 * Editing .env requires `npm start -- --reset-cache`: the plugin inlines values
 * at transform time, so a plain reload keeps the previous ones.
 */

/**
 * islamicapi.com key for fasting times.
 *
 * The previous value was hardcoded in two files and committed to the repo's
 * README, so it is in git history and must be rotated at the provider. Add
 * `ISLAMIC_API_KEY=...` to suhoor-native/.env.
 */
export const ISLAMIC_API_KEY = ENV_ISLAMIC_API_KEY ?? '';

export const ISLAMIC_API_BASE = 'https://islamicapi.com/api/v1';

/**
 * Fasting-times endpoint for a coordinate pair. Mirrors src/config/env.js on web
 * so the two apps cannot drift on query-string shape.
 */
export const fastingTimesUrl = (lat, lng) => {
  if (!ISLAMIC_API_KEY) {
    throw new Error(
      'ISLAMIC_API_KEY is not set in suhoor-native/.env — fasting times cannot be fetched.'
    );
  }
  return `${ISLAMIC_API_BASE}/fasting/?lat=${lat}&lon=${lng}&api_key=${ISLAMIC_API_KEY}`;
};

/**
 * Socket.IO server for presence and buzzing.
 *
 * `localhost` from an Android emulator points at the emulator itself, not the
 * host machine — use 10.0.2.2 (emulator) or the host's LAN IP (physical device).
 * For production, deploy backend and use deployed URL.
 */
export const SOCKET_URL = EXPO_PUBLIC_SOCKET_URL ?? 'http://10.0.2.2:3001';
