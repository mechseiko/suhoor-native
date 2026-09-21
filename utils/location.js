import AsyncStorage from "@react-native-async-storage/async-storage";
import { PermissionsAndroid, Platform } from "react-native";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";

const USER_LOCATION_KEY = "suhoor_user_location";

// Use community geolocation on native, fall back to browser API on web
let Geolocation;
try {
  Geolocation = require("@react-native-community/geolocation").default;
  console.log("Using @react-native-community/geolocation");
} catch (e) {
  console.log("Failed to load @react-native-community/geolocation:", e);
  Geolocation = typeof navigator !== "undefined" ? navigator.geolocation : null;
}

/**
 * Attempt to get the device's current GPS coordinates.
 * Uses @react-native-community/geolocation on native, navigator.geolocation on web.
 * Returns null on any failure (denied, unavailable, timeout).
 */
const getDeviceCoordinates = async () => {
  if (Platform.OS === "android") {
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      console.log("Location permission request result:", result);
      
      const fineGranted = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
      
      if (!fineGranted) {
        console.log("Fine location permission not granted:", result);
        return null;
      }
    } catch (error) {
      console.log("Error requesting location permission:", error);
      return null;
    }
  }

  return new Promise((resolve) => {
    if (!Geolocation) {
      console.log("Geolocation not available");
      resolve(null);
      return;
    }
    
    console.log("Attempting to get current position with high accuracy...");
    // First try with high accuracy
    Geolocation.getCurrentPosition(
      (position) => {
        console.log("High accuracy position obtained successfully:", position);
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.log("High accuracy geolocation error, trying low accuracy:", error);
        // Fallback to low accuracy
        Geolocation.getCurrentPosition(
          (position) => {
            console.log("Low accuracy position obtained successfully:", position);
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error2) => {
            console.log("Low accuracy geolocation also failed:", error2);
            resolve(null);
          },
          { timeout: 30000, maximumAge: 300000, enableHighAccuracy: false }
        );
      },
      { timeout: 15000, maximumAge: 300000, enableHighAccuracy: true }
    );
  });
};

/**
 * Get user's default location from their profile in Firestore.
 * @param {string} userId - The user's Firebase UID
 * @returns {Promise<{ lat: number, lng: number, name: string } | null>}
 */
const getProfileDefaultLocation = async (userId) => {
  if (!userId) return null;
  try {
    const profileRef = doc(db, "profiles", userId);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      const profileData = profileSnap.data();
      const defaultLocation = profileData?.preferences?.defaultLocation;
      if (defaultLocation?.lat && defaultLocation?.lng) {
        return defaultLocation;
      }
    }
  } catch (err) {
    console.error("Error fetching profile default location:", err);
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
          source: "saved",
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
        source: "gps",
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
          source: "profile",
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
    source: "none",
    error: "No location available. Please set your location in settings.",
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
    console.error("Failed to save user location:", err);
  }
};

/**
 * Clear the saved user location so the next launch falls through to GPS.
 */
export const clearUserLocation = async () => {
  try {
    await AsyncStorage.removeItem(USER_LOCATION_KEY);
  } catch (err) {
    console.error("Failed to clear user location:", err);
  }
};
