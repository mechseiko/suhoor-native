import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentCoordinates } from '../utils/location';
import { fastingTimesUrl } from '../config/env';
import { useAuth } from '../context/AuthContext';

const CACHE_KEY = 'suhoor_fasting_times';

/** Storage date key — always en-CA (YYYY-MM-DD), never the UI language. */
const todayKey = () => new Date().toLocaleDateString('en-CA');

export function useFastingTimes() {
  const { currentUser } = useAuth();
  const [location, setLocation] = useState({
    loaded: false,
    coordinates: null,
    source: null,
    error: null,
  });

  const [fastingData, setFastingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load cached fasting times on mount
  useEffect(() => {
    let cancelled = false;

    const loadCachedTimes = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (!cached) return;

        const parsed = JSON.parse(cached);

        // Invalidate cache if it's from a different day
        if (parsed.date !== todayKey()) {
          await AsyncStorage.removeItem(CACHE_KEY);
        } else if (!cancelled) {
          setFastingData(parsed.data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading cached fasting times:', err);
      }
    };

    loadCachedTimes();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve coordinates: user-set location, else device GPS, else profile default,
  // else no location available. utils/location always resolves, so this never leaves
  // the screen waiting on a permission the user declined.
  useEffect(() => {
    let cancelled = false;

    getCurrentCoordinates(currentUser?.uid).then(({ coordinates, source, error: locationError }) => {
      if (cancelled) return;
      setLocation({ loaded: true, coordinates, source, error: locationError });
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  // Fetch times once coordinates are known
  useEffect(() => {
    if (!location.loaded) return;
    if (!location.coordinates?.lat || !location.coordinates?.lng) {
      setLoading(false);
      setError('No location available. Please set your location in settings.');
      return;
    }
    if (fastingData) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchFastingTimes = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          fastingTimesUrl(location.coordinates.lat, location.coordinates.lng)
        );
        const data = await response.json();

        if (data.code === 200 && data.data?.fasting) {
          const newFastingData = { fasting: data.data.fasting };
          if (cancelled) return;
          setFastingData(newFastingData);

          await AsyncStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              data: newFastingData,
              date: todayKey(),
              timestamp: Date.now(),
            })
          );
        } else if (!cancelled) {
          setError('Invalid API response');
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load fasting times.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFastingTimes();
    return () => {
      cancelled = true;
    };
  }, [location.loaded, location.coordinates?.lat, location.coordinates?.lng, fastingData]);

  const todayData = fastingData?.fasting?.[0];

  /**
   * Is it time to wake up?
   *
   * The wake-up window opens `minutesBefore` minutes before suhoor ends and runs
   * until suhoor ends. The spec's default is 45 minutes, user-configurable up to
   * 120. This is a *window*, not an instant — an earlier version returned true
   * only within 60 seconds of the exact minute, so an app that was backgrounded
   * across that minute never fired at all.
   */
  const checkWakeUpWindow = useCallback(
    (minutesBefore = 45) => {
      if (!todayData?.time?.sahur) return false;

      const [hours, minutes] = todayData.time.sahur.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;

      const suhoorEnd = new Date();
      suhoorEnd.setHours(hours, minutes, 0, 0);

      const windowOpens = new Date(suhoorEnd.getTime() - minutesBefore * 60000);
      const now = Date.now();

      return now >= windowOpens.getTime() && now <= suhoorEnd.getTime();
    },
    [todayData]
  );

  return {
    fastingData,
    todayData,
    loading,
    error,
    location,
    isWakeUpWindow: checkWakeUpWindow(),
    checkWakeUpWindow,
  };
}

export default useFastingTimes;
