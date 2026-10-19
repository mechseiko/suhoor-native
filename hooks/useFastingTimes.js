import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentCoordinates } from '../utils/location';
import { fastingTimesUrl } from '../config/env';
import { useAuth } from '../context/AuthContext';

const CACHE_KEY = 'suhoor_fasting_times';

/** Storage date key — always en-CA (YYYY-MM-DD), never the UI language. */
const todayKey = () => new Date().toLocaleDateString('en-CA');

export function useFastingTimes() {
  const { currentUser, userProfile } = useAuth();
  const [location, setLocation] = useState({
    loaded: false,
    coordinates: null,
    source: null,
    error: null,
  });

  const [fastingData, setFastingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State to track day changes
  const [currentDayKey, setCurrentDayKey] = useState(todayKey());

  // Live clock tick so time-derived booleans stay fresh while the app is open.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Date.now());
      // FIX: Check if the day rolled over while the app was open
      const newKey = todayKey();
      setCurrentDayKey((prevKey) => {
        if (prevKey !== newKey) return newKey;
        return prevKey;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // User-configured wake-up minutes. 
  const wakeMinutes =
    userProfile?.preferences?.wakeUpMinutesBeforeSuhoor ?? null;

  // Load cached fasting times on mount or day change
  useEffect(() => {
    let cancelled = false;

    const loadCachedTimes = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (!cached) return;

        const parsed = JSON.parse(cached);

        // Invalidate cache if it's from a different day
        if (parsed.date !== currentDayKey) {
          await AsyncStorage.removeItem(CACHE_KEY);
          if (!cancelled) {
            setFastingData(null); // Trigger refetch for new day
            setLoading(true);
          }
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
  }, [currentDayKey]); // Re-run when day changes

  // Resolve coordinates
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
    // Only skip if we already have data FOR THE CURRENT DAY
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
  }, [location.loaded, location.coordinates?.lat, location.coordinates?.lng, fastingData, currentDayKey]);

  const todayData = fastingData?.fasting?.[0];

  const checkWakeUpWindow = useCallback(
    (minutesBefore = wakeMinutes) => {
      if (minutesBefore == null) return false;
      if (!todayData?.time?.sahur) return false;

      const [hours, minutes] = todayData.time.sahur.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;

      const suhoorEnd = new Date();
      suhoorEnd.setHours(hours, minutes, 0, 0);

      const windowOpens = new Date(suhoorEnd.getTime() - minutesBefore * 60000);
      const now = Date.now();

      return now >= windowOpens.getTime() && now <= suhoorEnd.getTime();
    },
    [todayData, wakeMinutes]
  );

  const isWakeUpWindow = useMemo(
    () => (wakeMinutes == null ? false : checkWakeUpWindow(wakeMinutes)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkWakeUpWindow, wakeMinutes, nowTick]
  );

  const hasSuhoorEnded = useMemo(() => {
    if (!todayData?.time?.sahur) return false;
    const [h, m] = todayData.time.sahur.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
    const end = new Date();
    end.setHours(h, m, 0, 0);
    return nowTick > end.getTime();
  }, [todayData, nowTick]);

  return {
    fastingData,
    todayData,
    loading,
    error,
    location,
    isWakeUpWindow,
    checkWakeUpWindow,
    hasSuhoorEnded,
    wakeMinutes,
  };
}

export default useFastingTimes;