import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import {
  COLLECTIONS,
  dateKey,
  wakeUpLogId,
  wakeUpLogDoc,
  missedWakeUpId,
  missedWakeUpDoc,
} from '../config/firestoreSchema';
import { useLanguage } from '../context/LanguageContext';
import {
  CHANNELS,
  configureNotifications,
  scheduleNotification,
  cancelNotification,
  getScheduledNotifications,
  checkPermissions,
  requestPermissions,
  notificationIdFor,
} from '../services/notifications';
import { useNativeAlarm } from './useNativeAlarm';

const STORAGE = {
  alarmId: 'suhoor_alarm_id',
  alarmTime: 'suhoor_alarm_time',
  userId: 'suhoor_alarm_user_id',
  groupId: 'suhoor_alarm_group_id',
};

// Configure the notification module as soon as the alarm layer is imported, so a
// notification that arrives before any component mounts is still delivered.
configureNotifications();

export function useAlarm() {
  const [hasPermission, setHasPermission] = useState(false);
  const [alarmScheduled, setAlarmScheduled] = useState(false);
  const nativeAlarm = useNativeAlarm();
  const alarmIdRef = useRef(null);
  const { t } = useLanguage();

  // Check permission on mount
  useEffect(() => {
    let cancelled = false;

    const checkPermission = async () => {
      if (nativeAlarm.isNativeAvailable) {
        // Native module available — check exact alarm permission
        const canSchedule = await nativeAlarm.canScheduleExactAlarms();
        if (!cancelled) setHasPermission(canSchedule);
        return;
      }

      // No native alarm engine — fall back to scheduled local notifications.
      const isEmulator = await DeviceInfo.isEmulator().catch(() => false);
      if (isEmulator) {
        // Emulators don't gate notification permission; don't block the UI on it.
        if (!cancelled) setHasPermission(true);
        return;
      }

      const existing = await checkPermissions();
      const granted = existing?.alert ? true : await requestPermissions();
      if (!cancelled) setHasPermission(Boolean(granted));
    };

    checkPermission();
    return () => {
      cancelled = true;
    };
  }, [nativeAlarm.isNativeAvailable]);

  // Schedule using the native Android alarm engine (exact, survives Doze)
  const scheduleNativeAlarm = useCallback(
    async (wakeUpTime, userId, groupId) => {
      try {
        const alarmId = `alarm_${userId}_${groupId}_${wakeUpTime.getTime()}`;

        const success = await nativeAlarm.scheduleAlarm(
          alarmId,
          wakeUpTime.getTime(),
          userId,
          groupId,
          'wake_up'
        );

        if (!success) return false;

        setAlarmScheduled(true);
        await AsyncStorage.multiSet([
          [STORAGE.alarmId, alarmId],
          [STORAGE.alarmTime, wakeUpTime.toISOString()],
          [STORAGE.userId, String(userId)],
          [STORAGE.groupId, String(groupId)],
        ]);
        return true;
      } catch (error) {
        console.error('Error scheduling native alarm:', error);
        return false;
      }
    },
    [nativeAlarm]
  );

  // Schedule using a local notification (fallback when the alarm engine is absent)
  const scheduleNotificationAlarm = useCallback(
    async (wakeUpTime, userId, groupId) => {
      try {
        if (alarmIdRef.current) cancelNotification(alarmIdRef.current);

        const semanticId = `alarm_${userId}_${groupId}_${wakeUpTime.getTime()}`;
        const scheduledId = await scheduleNotification({
          semanticId,
          date: wakeUpTime,
          title: t('alarm.notificationTitle'),
          message: t('alarm.notificationBody'),
          channel: CHANNELS.wakeUp,
          data: { userId, groupId, type: 'wake_up_alarm' },
        });

        if (!scheduledId) return false;

        alarmIdRef.current = scheduledId;
        setAlarmScheduled(true);
        await AsyncStorage.multiSet([
          [STORAGE.alarmId, scheduledId],
          [STORAGE.alarmTime, wakeUpTime.toISOString()],
          [STORAGE.userId, String(userId)],
          [STORAGE.groupId, String(groupId)],
        ]);
        return true;
      } catch (error) {
        console.error('Error scheduling notification alarm:', error);
        return false;
      }
    },
    [t]
  );

  const scheduleAlarm = useCallback(
    async (wakeUpTime, userId, groupId) => {
      if (!hasPermission) {
        console.warn('Alarm permission not granted');
        return false;
      }
      return nativeAlarm.isNativeAvailable
        ? scheduleNativeAlarm(wakeUpTime, userId, groupId)
        : scheduleNotificationAlarm(wakeUpTime, userId, groupId);
    },
    [hasPermission, nativeAlarm.isNativeAvailable, scheduleNativeAlarm, scheduleNotificationAlarm]
  );

  const clearStoredAlarm = useCallback(
    () => AsyncStorage.multiRemove(Object.values(STORAGE)),
    []
  );

  const cancelAlarm = useCallback(async () => {
    try {
      const storedId = await AsyncStorage.getItem(STORAGE.alarmId);

      if (nativeAlarm.isNativeAvailable) {
        if (!storedId) return false;
        const success = await nativeAlarm.cancelAlarm(storedId);
        if (!success) return false;
      } else if (storedId || alarmIdRef.current) {
        cancelNotification(storedId || alarmIdRef.current);
        alarmIdRef.current = null;
      }

      await clearStoredAlarm();
      setAlarmScheduled(false);
      return true;
    } catch (error) {
      console.error('Error cancelling alarm:', error);
      return false;
    }
  }, [nativeAlarm, clearStoredAlarm]);

  const checkAlarmStatus = useCallback(async () => {
    try {
      const storedId = await AsyncStorage.getItem(STORAGE.alarmId);
      if (!storedId) return false;

      if (nativeAlarm.isNativeAvailable) {
        const isScheduled = await nativeAlarm.isAlarmScheduled(storedId);
        setAlarmScheduled(isScheduled);
        return isScheduled;
      }

      const scheduled = await getScheduledNotifications();
      const exists = scheduled.some((notif) => String(notif.id) === String(storedId));
      setAlarmScheduled(exists);
      alarmIdRef.current = storedId;
      return exists;
    } catch (error) {
      console.error('Error checking alarm status:', error);
      return false;
    }
  }, [nativeAlarm]);

  /**
   * Logs a wake-up.
   *
   * The document id is `{userId}_{date}` — one wake-up per person per day, not
   * per group. Keying it by group (as an earlier version did) let the same
   * wake-up be logged once per group the user belongs to, which inflated streaks
   * and made the group roster disagree with the dashboard. `wake_up_logs` still
   * records `group_id`, so per-group views are unaffected.
   *
   * Written via the shared schema helpers so both apps produce identical
   * documents — including `woke_up_at` as an ISO string rather than a
   * serverTimestamp sentinel, which the web app cannot read back consistently.
   */
  const logWakeUpTime = useCallback(async (userId, groupId) => {
    try {
      const ref = doc(db, COLLECTIONS.wakeUpLogs, wakeUpLogId(userId));
      await setDoc(ref, wakeUpLogDoc({ userId, groupId }), { merge: true });
      return { success: true };
    } catch (error) {
      console.error('Error logging wake-up time:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const logMissedWakeUp = useCallback(async (userId, groupId) => {
    try {
      const ref = doc(db, COLLECTIONS.missedWakeUps, missedWakeUpId(userId, groupId));
      await setDoc(ref, missedWakeUpDoc({ userId, groupId }), { merge: true });
      return { success: true };
    } catch (error) {
      console.error('Error logging missed wake-up:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /** After suhoor ends, record everyone who intended to fast but never checked in. */
  const checkMissedWakeUps = useCallback(
    async (groupId, suhoorTime) => {
      try {
        const [hours, minutes] = String(suhoorTime).split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;

        const suhoorEnd = new Date();
        suhoorEnd.setHours(hours, minutes, 0, 0);
        if (Date.now() <= suhoorEnd.getTime()) return;

        const today = dateKey();

        const intendedSnapshot = await getDocs(
          query(
            collection(db, COLLECTIONS.dailyFastingStatus),
            where('date', '==', today),
            where('wantsToFast', '==', true)
          )
        );

        const wokeUpSnapshot = await getDocs(
          query(collection(db, COLLECTIONS.wakeUpLogs), where('date', '==', today))
        );

        const wokeUpUserIds = new Set();
        wokeUpSnapshot.forEach((entry) => wokeUpUserIds.add(entry.data().user_id));

        await Promise.all(
          intendedSnapshot.docs
            .map((entry) => entry.data().userId)
            .filter((userId) => userId && !wokeUpUserIds.has(userId))
            .map((userId) => logMissedWakeUp(userId, groupId))
        );
      } catch (error) {
        console.error('Error checking missed wake-ups:', error);
      }
    },
    [logMissedWakeUp]
  );

  // Restore a pending alarm after a restart; drop it if its time has passed.
  useEffect(() => {
    if (!hasPermission) return;

    const restoreAlarm = async () => {
      const alarmTimeStr = await AsyncStorage.getItem(STORAGE.alarmTime);
      if (!alarmTimeStr) return;

      const alarmTime = new Date(alarmTimeStr);
      if (Number.isNaN(alarmTime.getTime())) {
        await clearStoredAlarm();
        return;
      }

      if (alarmTime.getTime() > Date.now()) {
        const [[, userId], [, groupId]] = await AsyncStorage.multiGet([
          STORAGE.userId,
          STORAGE.groupId,
        ]);
        if (userId && groupId) await scheduleAlarm(alarmTime, userId, groupId);
      } else {
        await cancelAlarm();
      }
    };

    restoreAlarm();
  }, [hasPermission, scheduleAlarm, cancelAlarm, clearStoredAlarm]);

  return {
    hasPermission,
    alarmScheduled,
    scheduleAlarm,
    cancelAlarm,
    checkAlarmStatus,
    logWakeUpTime,
    logMissedWakeUp,
    checkMissedWakeUps,
    // Exposed for callers that need to line up a native id with a stored one.
    notificationIdFor,
    platform: Platform.OS,
  };
}

export default useAlarm;
