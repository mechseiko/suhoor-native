import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mechseiko.suhoor';
const CACHE_KEY = 'cached_play_store_version';
const CACHE_TIME_KEY = 'cached_play_store_version_time';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns current installed app version
 */
export const getCurrentVersion = () => {
  try {
    if (DeviceInfo && typeof DeviceInfo.getVersion === 'function') {
      const v = DeviceInfo.getVersion();
      if (v && typeof v === 'string' && v.trim().toLowerCase() !== 'unknown' && /^[0-9]/.test(v.trim())) {
        return v.trim();
      }
    }
  } catch (e) {
    // DeviceInfo not available (e.g., web or Expo Go)
  }
  // Try expo-constants as fallback (works in Expo and web builds)
  try {
    const Constants = require('expo-constants').default;
    const expoVersion = Constants?.expoConfig?.version || Constants?.manifest?.version;
    if (expoVersion && typeof expoVersion === 'string' && expoVersion.trim().toLowerCase() !== 'unknown' && /^[0-9]/.test(expoVersion.trim())) {
      return expoVersion.trim();
    }
  } catch (e) {
    // expo-constants not available
  }
  // Fallback to app.json configuration if accessible
  try {
    const appJson = require('../app.json');
    const configVer = appJson?.expo?.version;
    if (configVer && typeof configVer === 'string' && configVer.trim().toLowerCase() !== 'unknown' && /^[0-9]/.test(configVer.trim())) {
      return configVer.trim();
    }
  } catch (e) {}

  return '1.0.9'; // Fallback matching Android versionName
};

/**
 * Compares two semantic version strings (e.g., '1.0.9' and '1.0.8').
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if equal
 */
export const compareVersions = (v1, v2) => {
  if (!v1 || !v2) return 0;
  const parts1 = String(v1).replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = String(v2).replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

/**
 * Fetches the latest published app version directly from Google Play Store
 * with Firestore config fallback & AsyncStorage caching.
 */
export const getLatestPlayStoreVersion = async (forceRefresh = false) => {
  try {
    const now = Date.now();
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && (now - Number(cachedTime) < CACHE_TTL_MS)) {
        return cached;
      }
    }

    let detectedVersion = null;

    // 1. First attempt: Query Google Play Store web details directly
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${PLAY_STORE_URL}&hl=en&gl=US`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36',
          'Cache-Control': 'no-cache',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        // Match version patterns from Google Play Store markup:
        // Pattern 1: [[["1.0.9"]]]
        // Pattern 2: "softwareVersion":"1.0.9"
        // Pattern 3: \"1.0.9\" in script data blocks
        const match =
          text.match(/\[\[\["([0-9]+\.[0-9]+(?:\.[0-9]+)?)"\]\]/) ||
          text.match(/"softwareVersion"\s*:\s*"([0-9]+\.[0-9]+(?:\.[0-9]+)?)"/) ||
          text.match(/\["([0-9]+\.[0-9]+\.[0-9]+)",\[/) ||
          text.match(/Current Version.*?>([0-9]+\.[0-9]+(?:\.[0-9]+)?)</);

        if (match && match[1]) {
          detectedVersion = match[1];
          console.log('[VersionService] Detected version from Play Store HTML:', detectedVersion);
        }
      }
    } catch (err) {
      console.log('[VersionService] Direct Play Store fetch notice:', err?.message || err);
    }

    // 2. Second attempt: Check Firestore developer/admin config document (app_version or system_config)
    if (!detectedVersion) {
      try {
        const configDoc = await getDoc(doc(db, 'system_config', 'app_version'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data?.latest_version) {
            detectedVersion = data.latest_version;
            console.log('[VersionService] Detected version from Firestore config:', detectedVersion);
          }
        }
      } catch (fbErr) {
        // Silently continue if document does not exist
      }
    }

    // 3. Fallback: if offline or unable to reach, return cached or current
    if (!detectedVersion) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      detectedVersion = cached || getCurrentVersion();
    } else {
      await AsyncStorage.setItem(CACHE_KEY, detectedVersion);
      await AsyncStorage.setItem(CACHE_TIME_KEY, String(now));
    }

    return detectedVersion;
  } catch (error) {
    console.error('[VersionService] Error checking version:', error);
    return getCurrentVersion();
  }
};

/**
 * Checks whether an update is available on Google Play Store
 */
export const checkAppUpdate = async () => {
  const current = getCurrentVersion();
  const latest = await getLatestPlayStoreVersion();
  const isValidLatest = latest && typeof latest === 'string' && latest.trim().toLowerCase() !== 'unknown' && /^[0-9]/.test(latest.trim());
  const isValidCurrent = current && typeof current === 'string' && current.trim().toLowerCase() !== 'unknown' && /^[0-9]/.test(current.trim());
  const isAvailable = Boolean(isValidLatest && isValidCurrent && compareVersions(latest, current) > 0);
  return {
    isAvailable,
    currentVersion: current,
    latestVersion: latest || current,
    playStoreUrl: PLAY_STORE_URL,
  };
};
