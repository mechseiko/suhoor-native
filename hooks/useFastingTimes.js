import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentCoordinates } from '../utils/location';
import { fastingTimesUrl } from '../config/env';
import { useAuth } from '../context/AuthContext';

const CACHE_KEY = 'suhoor_fasting_times';
/**
 * Cache for the day *after* today, which is what the daily prompt targets for
 * most of the day (07:00 -> midnight) and what its alarm is armed for.
 * The API's default response only contains today, so this row is fetched with
 * an explicit `&date=` and kept separately.
 */
const NEXT_CACHE_KEY = 'suhoor_fasting_times_next';

/** Storage date key — always en-CA (YYYY-MM-DD), never the UI language. */
const todayKey = () => new Date().toLocaleDateString('en-CA');
const toDateKey = (d) => d.toLocaleDateString('en-CA');
const tomorrowKey = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
};

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
  /** Next day's API row, for the prompt's target date + its alarm time. */
  const [nextDay, setNextDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDayKey, setCurrentDayKey] = useState(todayKey());
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [currentUser?.uid, refreshKey]);

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

  // Load the cached row for tomorrow (survives the no-network launch).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(NEXT_CACHE_KEY);
        if (!cached) return;
        const parsed = JSON.parse(cached);
        const key = tomorrowKey();
        if (parsed?.date === key && parsed?.row) {
          if (!cancelled) setNextDay({ date: key, row: parsed.row });
        } else {
          // Stale (yesterday's "tomorrow", or a corrupted entry).
          await AsyncStorage.removeItem(NEXT_CACHE_KEY);
        }
      } catch (err) {
        console.log('Could not read next-day fasting cache:', err?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [currentDayKey]);

  // Fetch tomorrow explicitly. The default API response is one day only, so
  // without this the prompt could not know the target day's suhoor at all.
  useEffect(() => {
    if (!location.loaded || !location.coordinates?.lat || !location.coordinates?.lng) return;
    if (!fastingData) return; // today first; keeps request order predictable
    const key = tomorrowKey();
    if (nextDay?.date === key) return;

    let cancelled = false;

    const fetchNextDay = async () => {
      try {
        const response = await fetch(
          `${fastingTimesUrl(location.coordinates.lat, location.coordinates.lng)}&date=${key}`
        );
        const data = await response.json();
        const row = data?.code === 200 ? data.data?.fasting?.[0] : null;
        if (cancelled || !row?.time?.sahur) return;

        setNextDay({ date: key, row });
        await AsyncStorage.setItem(
          NEXT_CACHE_KEY,
          JSON.stringify({ date: key, row })
        );
      } catch (err) {
        // Offline: getSuhoor() still falls back to today's time.
        console.log('Could not fetch next-day fasting times:', err?.message);
      }
    };

    fetchNextDay();
    return () => { cancelled = true; };
  }, [
    location.loaded,
    location.coordinates?.lat,
    location.coordinates?.lng,
    fastingData,
    nextDay,
  ]);

  const fastingDays = fastingData?.fasting ?? [];
  const todayData = fastingDays[0] ?? null;

  /**
   * Resolve the day row for a given en-CA date key.
   * Prefers an explicit `date` field on each row; falls back to array
   * indexing ([today, tomorrow, ...]) for APIs that don't include a date.
   * Tomorrow's row comes from its own fetch/cache (see NEXT_CACHE_KEY).
   */
  const getDayData = useCallback((dateKey) => {
    if (!dateKey) return null;
    const byDate = fastingDays.find((d) => d?.date === dateKey);
    if (byDate) return byDate;

    if (nextDay?.date === dateKey && nextDay.row) return nextDay.row;

    const todayStr = todayKey();
    if (dateKey === todayStr) return fastingDays[0] ?? null;

    if (dateKey === tomorrowKey()) return fastingDays[1] ?? null;

    return null;
  }, [fastingDays, nextDay]);

  /**
   * Suhoor end for the given date key, as a local Date, or null.
   *
   * For tomorrow this uses the row fetched with `&date=` (accurate to the
   * minute). Only when that request failed — offline on a fresh install — does
   * it fall back to today's suhoor shifted one minute earlier, so the alarm can
   * never ring after suhoor.
   */
  const getSuhoor = useCallback((dateKey) => {
    const day = getDayData(dateKey);
    let sahur = day?.time?.sahur;

    if (!sahur && dateKey) {
      const todayStr = todayKey();
      if (dateKey !== todayStr) {
        const target = new Date(`${dateKey}T00:00:00`);
        const today = new Date(`${todayStr}T00:00:00`);
        const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
        if (diffDays === 1) {
          sahur = fastingDays[0]?.time?.sahur;
        }
      }
    }

    if (!sahur) return null;
    const [h, m] = sahur.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const d = new Date(`${dateKey}T00:00:00`);
    // One-minute safety margin for the approximate (tomorrow) case.
    d.setHours(h, day?.time?.sahur ? m : m - 1, 0, 0);
    return d;
  }, [getDayData, fastingDays]);

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
    refreshKey,
    setRefreshKey,
    // NEW — used by FastingPrompt to resolve the target day's suhoor/wakeStart
    getDayData,
    getSuhoor,
    getWakeStart,
  };
}

export default useFastingTimes;