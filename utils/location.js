/**
 * Location utilities for the Suhoor mobile app.
 *
 * Always resolves — it never rejects or leaves the caller waiting on a
 * permission the user declined. The priority order is:
 *
 *   1. User-set city/coordinates saved in AsyncStorage (fastest, offline-safe)
 *   2. Device GPS (when permission is granted)
 *   3. User's default location from database (if set)
 *   4. No location available (error state)
 *
 * The resolved `source` field tells the caller which path was taken so it can
 * show an appropriate notice when no location is available.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
 * Get user's default location from their profile in Firestore.
 * @param {string} userId - The user's Firebase UID
 * @returns {Promise<{ lat: number, lng: number, name: string } | null>}
 */
const getProfileDefaultLocation = async (userId) => {
  if (!userId) return null;
  try {
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      const profileData = profileSnap.data();
      const defaultLocation = profileData?.preferences?.defaultLocation;
      if (defaultLocation?.lat && defaultLocation?.lng) {
        return defaultLocation;
      }
    }
  } catch (err) {
    console.error('Error fetching profile default location:', err);
  }
  return null;
};

/**
 * Resolve the best available coordinates for the current user.
 *
 * @param {string} userId - The user's Firebase UID (optional, for profile fallback)
 * @returns {Promise<{ coordinates: { lat: number, lng: number }, source: string, error: string | null }>}
 */
export const getCurrentCoordinates = async (userId) => {
  // 1. User-set location from AsyncStorage (fastest, offline-safe)
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
        coordinates: { lat: coords.lat, lng: coords.lng },
        source: 'gps',
        error: null,
      };
    }
  } catch {
    // GPS unavailable
  }

  // 3. User's default location from database profile
  if (userId) {
    try {
      const profileLocation = await getProfileDefaultLocation(userId);
      if (profileLocation) {
        return {
          coordinates: { lat: profileLocation.lat, lng: profileLocation.lng },
          source: 'profile',
          error: null,
        };
      }
    } catch {
      // Profile fetch failed
    }
  }

  // 4. No location available
  return {
    coordinates: null,
    source: 'none',
    error: 'No location available. Please set your location in settings.',
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
