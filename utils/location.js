/**
 * Location utilities for the Suhoor mobile app.
 *
 * Always resolves — it never rejects or leaves the caller waiting on a
 * permission the user declined. The priority order is:
 *
 *   1. User-set city/coordinates saved in AsyncStorage (fastest, offline-safe)
 *   2. Device GPS (when permission is granted)
 *   3. Fallback default location (Lagos, Nigeria)
 *
 * The resolved `source` field tells the caller which path was taken so it can
 * show an appropriate notice when GPS fell back to the default.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Default location — Lagos, Nigeria */
const DEFAULT_LOCATION = {
  coordinates: { lat: 6.5244, lng: 3.3792 },
  source: 'default',
};

const USER_LOCATION_KEY = 'suhoor_user_location';

/**
 * Attempt to get the device's current GPS coordinates via the browser/native
 * Geolocation API.  Returns null on any failure (denied, unavailable, timeout).
 */
const getDeviceCoordinates = () =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  });

/**
 * Resolve the best available coordinates for the current user.
 *
 * @returns {Promise<{ coordinates: { lat: number, lng: number }, source: string, error: string | null }>}
 */
export const getCurrentCoordinates = async () => {
  // 1. User-set location
  try {
    const saved = await AsyncStorage.getItem(USER_LOCATION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.lat && parsed?.lng) {
        return {
          coordinates: { lat: parsed.lat, lng: parsed.lng },
          source: 'saved',
          error: null,
        };
      }
    }
  } catch {
    // ignore cache read errors
  }

  // 2. Device GPS
  try {
    const coords = await getDeviceCoordinates();
    if (coords) {
      return {
        coordinates: coords,
        source: 'gps',
        error: null,
      };
    }
  } catch {
    // GPS unavailable
  }

  // 3. Fallback
  return {
    ...DEFAULT_LOCATION,
    error: 'Using default location (GPS unavailable)',
  };
};

/**
 * Persist user-chosen coordinates so subsequent launches skip GPS.
 * @param {{ lat: number, lng: number }} coordinates
 */
export const saveUserLocation = async (coordinates) => {
  try {
    await AsyncStorage.setItem(USER_LOCATION_KEY, JSON.stringify(coordinates));
  } catch (err) {
    console.error('Failed to save user location:', err);
  }
};

/**
 * Clear the saved user location so the next launch falls through to GPS.
 */
export const clearUserLocation = async () => {
  try {
    await AsyncStorage.removeItem(USER_LOCATION_KEY);
  } catch (err) {
    console.error('Failed to clear user location:', err);
  }
};
