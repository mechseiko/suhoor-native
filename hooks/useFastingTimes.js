import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentCoordinates } from '../utils/location';
import { fastingTimesUrl } from '../config/env';
import { useAuth } from '../context/AuthContext';

const CACHE_KEY = 'suhoor_fasting_times';

/** Storage date key — always en-CA (YYYY-MM-DD), never the UI language. */
const todayKey = () => new Date().toLocaleDateString('en-CA');
const toDateKey = (d) => d.toLocaleDateString('en-CA');

/** Default minutes before suhoor to open the wake-up window. */
const DEFAULT_WAKE_MINUTES = 45;

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
  const [currentDayKey, setCurrentDayKey] = useState(todayKey());

  // Live clock tick so time-derived values stay fresh while the app is open.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Date.now());
      const newKey = todayKey();
      setCurrentDayKey((prev) => (prev !== newKey ? newKey : prev));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // User-configured wake-up minutes. 45 is the documented default.
  const wakeMinutes =
    userProfile?.preferences?.wakeUpMinutesBeforeSuhoor ?? DEFAULT_WAKE_MINUTES;

  // Load cached fasting times on mount or day change
  useEffect(() => {
    let cancelled = false;

    const loadCachedTimes = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (!cached) return;

        const parsed = JSON.parse(cached);

        if (parsed.date !== currentDayKey) {
          await AsyncStorage.removeItem(CACHE_KEY);
          if (!cancelled) {
            setFastingData(null);
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
    return () => { cancelled = true; };
  }, [currentDayKey]);

  // Resolve coordinates
  useEffect(() => {
    let cancelled = false;
    getCurrentCoordinates(currentUser?.uid).then(({ coordinates, source, error: locationError }) => {
      if (cancelled) return;
      setLocation({ loaded: true, coordinates, source, error: locationError });
    });
    return () => { cancelled = true; };
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
    return () => { cancelled = true; };
  }, [location.loaded, location.coordinates?.lat, location.coordinates?.lng, fastingData]); // REMOVED currentDayKey from dependencies

  const fastingDays = fastingData?.fasting ?? [];
  const todayData = fastingDays[0] ?? null;

  /**
   * Resolve the day row for a given en-CA date key.
   * Prefers an explicit `date` field on each row; falls back to array
   * indexing ([today, tomorrow, ...]) for APIs that don't include a date.
   */
  const getDayData = useCallback((dateKey) => {
    if (!dateKey) return null;
    const byDate = fastingDays.find((d) => d?.date === dateKey);
    if (byDate) return byDate;

    const todayStr = todayKey();
    if (dateKey === todayStr) return fastingDays[0] ?? null;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateKey === toDateKey(tomorrow)) return fastingDays[1] ?? null;

    return null;
  }, [fastingDays]);

  /** Suhoor end for the given date key, as a local Date, or null. */
  const getSuhoor = useCallback((dateKey) => {
    const day = getDayData(dateKey);
    if (!day?.time?.sahur) return null;
    const [h, m] = day.time.sahur.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const d = new Date(`${dateKey}T00:00:00`);
    d.setHours(h, m, 0, 0);
    return d;
  }, [getDayData]);

  /**
   * Wake-up-window start = suhoor(date) - minutesBefore.
   * minutesBefore defaults to the user's preference, then 45.
   */
  const getWakeStart = useCallback((dateKey, minutesBefore) => {
    const suhoor = getSuhoor(dateKey);
    if (!suhoor) return null;
    const mins = minutesBefore ?? wakeMinutes;
    if (!Number.isFinite(mins)) return null;
    return new Date(suhoor.getTime() - mins * 60000);
  }, [getSuhoor, wakeMinutes]);

  /** True iff now is inside [wakeStart, suhoor] for the given day. */
  const checkWakeUpWindow = useCallback((dateKey, minutesBefore) => {
    const key = dateKey || todayKey();
    const wakeStart = getWakeStart(key, minutesBefore);
    if (!wakeStart) return false;
    const suhoor = getSuhoor(key);
    if (!suhoor) return false;
    const now = Date.now();
    return now >= wakeStart.getTime() && now <= suhoor.getTime();
  }, [getWakeStart, getSuhoor]);

  const isWakeUpWindow = useMemo(
    () => checkWakeUpWindow(),
    [checkWakeUpWindow, nowTick]
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
    fastingDays,
    todayData,
    loading,
    error,
    location,
    isWakeUpWindow,
    checkWakeUpWindow,
    hasSuhoorEnded,
    wakeMinutes,
    // NEW — used by FastingPrompt to resolve the target day's suhoor/wakeStart
    getDayData,
    getSuhoor,
    getWakeStart,
  };
}

export default useFastingTimes;