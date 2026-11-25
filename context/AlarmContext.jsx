import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import {
  subscribeToNotifications,
  scheduleNotification,
  cancelNotification,
  CHANNELS,
} from '../services/notifications';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useLanguage } from './LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/firestoreSchema';
import { doc, getDoc } from 'firebase/firestore';
import { useFastingTimes } from '../hooks/useFastingTimes';
import { useNativeAlarm } from '../hooks/useNativeAlarm';
import { getAlarmSoundResourceName } from '../utils/soundGenerator';
import { DAILY_ALARM_ID, ALARM_STORAGE } from '../constants/alarm';

const ALARM_TYPES = new Set(['wake_up_alarm']);
const DAILY_ALARM_KEY = ALARM_STORAGE.alarmTime;
const FASTING_PROMPT_DISMISS_KEY = 'suhoor_fasting_prompt_dismissed';
const IFTAR_NOTIFICATION_KEY = 'suhoor_iftar_scheduled';
const CHECKIN_NOTIFICATION_KEY = 'suhoor_checkin_reminder_scheduled';

const AlarmContext = createContext({});

export const useAlarmState = () => useContext(AlarmContext);

export const AlarmProvider = ({ children }) => {
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [alarmData, setAlarmData] = useState(null);
  const [scheduledAlarmTime, setScheduledAlarmTime] = useState(null);
  const { currentUser, userProfile } = useAuth();
  const { on, off } = useSocket();
  const { t } = useLanguage();
  const { todayData } = useFastingTimes();
  const { triggerRemoteBuzz, scheduleAlarm: scheduleNativeAlarm, consumeAlarmTrigger, clearAlarmTrigger } = useNativeAlarm();

  // The alarm UI must survive a foreground transition. This used to reset
  // isAlarmActive on every AppState 'active', which hid the PIN overlay while
  // the foreground service kept ringing — and because the native trigger had
  // already been consumed on read, there was nothing left to reopen it. The
  // user's only way out was force-stopping the app.
  //
  // Reconciliation now happens in one place (see the effect further down): a
  // pending native trigger opens the overlay, and a still-ringing service
  // re-opens it if it somehow got hidden. Nothing clears the state unless the
  // user actually dismisses the alarm.

  // Restore the native "muted groups" store from local settings. The FCM buzz
  // path is native-only, so the mute flags must live there as well.
  useEffect(() => {
    if (Platform.OS !== 'android' || !NativeModules?.AlarmBridge?.setMutedGroup) return;
    (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const mutedKeys = keys.filter((k) => k.startsWith('@suhoor_group_mute_'));
        await Promise.all(
          mutedKeys.map(async (key) => {
            const groupId = key.replace('@suhoor_group_mute_', '');
            const value = await AsyncStorage.getItem(key);
            if (value === 'true' && groupId) {
              await NativeModules.AlarmBridge.setMutedGroup(groupId, true);
            }
          })
        );
      } catch (e) {
        console.warn('Could not restore muted groups:', e);
      }
    })();
  }, []);

  // Kept in refs: useNativeAlarm() returns fresh closures on every render, and
  // these listeners must be registered exactly once.
  const consumeAlarmTriggerRef = useRef(consumeAlarmTrigger);
  useEffect(() => {
    consumeAlarmTriggerRef.current = consumeAlarmTrigger;
  }, [consumeAlarmTrigger]);

  const clearAlarmTriggerRef = useRef(clearAlarmTrigger);
  useEffect(() => {
    clearAlarmTriggerRef.current = clearAlarmTrigger;
  }, [clearAlarmTrigger]);

  /**
   * Single reconciliation point between the native alarm and this UI.
   *
   * Runs on mount and on every resume:
   *  1. a pending native trigger (the user tapped "Enter PIN" or the alarm
   *     notification) opens the PIN overlay — the read is non-destructive, so
   *     missing it once costs nothing;
   *  2. otherwise, if the foreground service is still ringing, the overlay is
   *     reopened, so a ringing alarm is always dismissable;
   *  3. otherwise nothing is touched. Only an explicit dismiss clears the state.
   */
  useEffect(() => {
    let cancelled = false;

    const reconcile = async () => {
      if (Platform.OS !== 'android') return;

      try {
        const readTrigger = consumeAlarmTriggerRef.current;
        const trigger =
          typeof readTrigger === 'function' ? await readTrigger() : null;
        if (cancelled) return;

        if (trigger) {
          console.log('⏰ Native alarm handed off to PIN overlay:', trigger);
          setAlarmData({
            type: trigger.alarmType === 'remote_buzz' ? 'buzz' : 'wake_up_alarm',
            fromNative: true,
            alarmId: trigger.alarmId,
          });
          setIsAlarmActive(true);
          return;
        }

        const bridge = NativeModules?.AlarmBridge;
        if (!bridge?.isAlarmRinging) return;
        const ringing = await bridge.isAlarmRinging().catch(() => false);
        if (cancelled || !ringing) return;

        console.log('⏰ Native alarm still ringing — reopening the PIN overlay');
        setAlarmData((previous) =>
          previous ?? { type: 'wake_up_alarm', fromNative: true }
        );
        setIsAlarmActive(true);
      } catch (e) {
        console.warn('Could not reconcile the native alarm state:', e);
      }
    };

    reconcile();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') reconcile();
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    const handleGetBuzzed = async (data) => {
      console.log('🔔 Received incoming buzz:', data);

      // Use native Android alarm for buzz - works even when app is closed
      if (Platform.OS === 'android' && NativeModules && NativeModules.AlarmBridge) {
        try {
          // Use the server-generated id: the same buzz may also arrive as an
          // FCM push, and the native side de-duplicates on this value.
          const alarmId =
            data.alarmId || `buzz_${currentUser.uid}_${data.fromUserId}_${Date.now()}`;
          const success = await triggerRemoteBuzz(
            alarmId,
            currentUser.uid,
            data.groupId || '',
            data.fromUserId || ''
          );
          if (success) {
            console.log('Native buzz alarm scheduled successfully');
          } else {
            console.error('Failed to schedule native buzz alarm');
          }
        } catch (error) {
          console.error('Error scheduling native buzz alarm:', error);
        }
      } else {
        // Fallback to React Native overlay for iOS or if native module unavailable
        setIsAlarmActive(true);
        setAlarmData({
          type: 'buzz',
          ...data,
        });
      }
    };

    if (on) {
      on('get-buzzed', handleGetBuzzed);
    }

    return () => {
      if (off) {
        off('get-buzzed', handleGetBuzzed);
      }
    };
  }, [on, off, userProfile, currentUser, triggerRemoteBuzz]);

  useEffect(() => {
    // Subscribe to incoming local/push notification triggers
    const unsubscribe = subscribeToNotifications((data) => {
      if (data && ALARM_TYPES.has(data.type)) {
        setIsAlarmActive(true);
        setAlarmData(data);
      }
    });

    // Clear a stale stored alarm time (more than an hour in the past). This no
    // longer touches isAlarmActive/alarmData: resetting them on mount used to
    // wipe a ringing alarm's overlay whenever `currentUser` changed, e.g. a
    // profile write completing while the alarm was on screen.
    AsyncStorage.getItem(DAILY_ALARM_KEY).then((timeStr) => {
      if (timeStr) {
        const alarmDate = new Date(timeStr);
        const now = Date.now();
        const diff = now - alarmDate.getTime();

        // If alarm was more than 1 hour ago, clear it (stale)
        if (diff > 60 * 60 * 1000) {
          console.log('Clearing stale alarm time from', alarmDate.toISOString());
          AsyncStorage.removeItem(DAILY_ALARM_KEY).catch(() => {});
          setScheduledAlarmTime(null);
        } else {
          setScheduledAlarmTime(alarmDate);
        }
      }
    }).catch((err) => {
      console.error('Error checking stored alarm time:', err);
    });

    return unsubscribe;
  }, [currentUser]);

  // Foreground heartbeat: if scheduled alarm time arrives while app is open, activate alarm immediately
  useEffect(() => {
    if (!scheduledAlarmTime || isAlarmActive) return;

    const checkAlarmTrigger = async () => {
      const now = Date.now();
      const alarmMs = scheduledAlarmTime.getTime();
      const diff = now - alarmMs;

      // Within 5 minutes past alarm time, trigger if not already dismissed today
      // Reduced from 2.5 hours to prevent late triggers
      if (diff >= 0 && diff < 5 * 60 * 1000) {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const dismissedKey = `suhoor_alarm_dismissed_${todayStr}`;
        const alreadyDismissed = await AsyncStorage.getItem(dismissedKey);
        if (!alreadyDismissed) {
          console.log('⏰ Foreground alarm trigger at', new Date(now).toISOString(), 'scheduled for', scheduledAlarmTime.toISOString());
          setIsAlarmActive(true);
          setAlarmData({
            type: 'wake_up_alarm',
            time: scheduledAlarmTime.toISOString(),
          });
        }
      }
    };

    const interval = setInterval(checkAlarmTrigger, 1000);
    checkAlarmTrigger();
    return () => clearInterval(interval);
  }, [scheduledAlarmTime, isAlarmActive]);

  const scheduleDailySuhoorAlarm = useCallback(
    async (targetTime, label = 'Suhoor Wake Up') => {
      try {
        if (!targetTime) return false;
        const alarmDate = targetTime instanceof Date ? targetTime : new Date(targetTime);

        // Cancel previous scheduled daily alarm
        await cancelNotification(DAILY_ALARM_ID);

        // Cancel previous native alarm if available
        if (Platform.OS === 'android' && NativeModules && NativeModules.AlarmBridge && NativeModules.AlarmBridge.cancelAlarm) {
          try {
            await NativeModules.AlarmBridge.cancelAlarm(DAILY_ALARM_ID);
          } catch (e) {}
        }

        // Reset today's dismissed status so the new alarm will fire
        const todayStr = new Date().toLocaleDateString('en-CA');
        await AsyncStorage.removeItem(`suhoor_alarm_dismissed_${todayStr}`);

        // Schedule exact native Android alarm (survives Doze, device sleep, and deep background)
        let nativeArmed = false;
        if (Platform.OS === 'android' && NativeModules && NativeModules.AlarmBridge && NativeModules.AlarmBridge.scheduleAlarm) {
          try {
            // Native side plays its own raw resource, so pass the resource
            // name (not the RN sound id) and the user's volume.
            const nativeSound = getAlarmSoundResourceName(
              userProfile?.preferences?.alarmSound || 'default'
            );
            const nativeVolume =
              userProfile?.preferences?.soundEnabled === false
                ? 0
                : typeof userProfile?.preferences?.alarmVolume === 'number'
                  ? userProfile.preferences.alarmVolume
                  : 1;

            if (nativeVolume <= 0.001) {
              // Honored, but never silently: HomeScreen shows a red "audible
              // alarms are off" card for exactly this state.
              console.warn(
                '⏰ Arming the Suhoor alarm at volume 0 — audible alarms are disabled in preferences.'
              );
            }

            const ok = await scheduleNativeAlarm(
              DAILY_ALARM_ID,
              alarmDate.getTime(),
              currentUser?.uid || '',
              '',
              'wake_up',
              nativeSound,
              nativeVolume
            );
            nativeArmed = ok === true;
            if (ok) {
              console.log('⏰ Native exact alarm scheduled for:', alarmDate.toISOString());
            } else {
              // Most often: "Alarms & reminders" access is off, so
              // setExactAndAllowWhileIdle is refused. The Home reliability card
              // surfaces this to the user.
              console.warn(
                '⏰ Native exact alarm was NOT scheduled (check exact-alarm permission) for:',
                alarmDate.toISOString()
              );
            }
          } catch (nativeErr) {
            console.warn('Native exact alarm scheduling error:', nativeErr);
          }
        }

        // Determine sound to use based on user preferences
        let soundName = 'default';
        if (userProfile?.preferences?.alarmAudioMode === 'custom' && userProfile?.preferences?.customAlarmAudioUrl) {
          soundName = userProfile.preferences.customAlarmAudioUrl;
        }

        // Second scheduler, only as a fallback.
        //
        // This used to run unconditionally, so the same suhoor was queued twice:
        // once in AlarmManager (native, full-screen + PIN) and once through
        // react-native-push-notification. Now that the push-notification path
        // actually works again (see the receivers in AndroidManifest.xml), both
        // would fire — two notifications and two rings for one alarm. The
        // native engine owns the alarm whenever it accepted it; the notification
        // remains the fallback for builds without AlarmBridge, or when arming
        // was refused.
        if (!nativeArmed) {
          await scheduleNotification({
            semanticId: DAILY_ALARM_ID,
            date: alarmDate,
            title: t('alarm.notificationTitle', '⏰ Suhoor Time!'),
            message:
              label ||
              t('alarm.notificationMessage', 'Wake up for Sahur and your blessed fast. May Allah accept your worship!'),
            channel: CHANNELS.wakeUp,
            soundName,
            data: {
              userId: currentUser?.uid,
              type: 'wake_up_alarm',
              time: alarmDate.toISOString(),
            },
          });
        }

        setScheduledAlarmTime(alarmDate);
        // One storage key set, shared with useAlarm.js. The native id has to be
        // recorded or useAlarm().cancelAlarm() has nothing to cancel — it used
        // to read a key that was never written and silently did nothing.
        await AsyncStorage.multiSet([
          [ALARM_STORAGE.alarmId, DAILY_ALARM_ID],
          [ALARM_STORAGE.alarmTime, alarmDate.toISOString()],
          [ALARM_STORAGE.userId, String(currentUser?.uid || '')],
          [ALARM_STORAGE.groupId, ''],
        ]);
        return true;
      } catch (err) {
        console.error('Failed to schedule daily Suhoor alarm:', err);
        return false;
      }
    },
    [currentUser, userProfile]
  );

  const cancelDailySuhoorAlarm = useCallback(async () => {
    try {
      await cancelNotification(DAILY_ALARM_ID);
      if (Platform.OS === 'android' && NativeModules && NativeModules.AlarmBridge && NativeModules.AlarmBridge.cancelAlarm) {
        try {
          await NativeModules.AlarmBridge.cancelAlarm(DAILY_ALARM_ID);
        } catch (e) {}
      }
      setScheduledAlarmTime(null);
      await AsyncStorage.multiRemove(Object.values(ALARM_STORAGE));
      return true;
    } catch (err) {
      console.error('Failed to cancel daily Suhoor alarm:', err);
      return false;
    }
  }, []);

  const dismissAlarm = async () => {
    setIsAlarmActive(false);
    setAlarmData(null);
    if (Platform.OS === 'android' && NativeModules?.AlarmBridge?.stopAlarmService) {
      try {
        await NativeModules.AlarmBridge.stopAlarmService();
      } catch (e) {}
    }
    // Acknowledge the native hand-off. Without this the non-destructive trigger
    // would reopen the overlay on the next resume, after the user dismissed it.
    try {
      await clearAlarmTriggerRef.current?.();
    } catch (e) {}
    const todayStr = new Date().toLocaleDateString('en-CA');
    await AsyncStorage.setItem(`suhoor_alarm_dismissed_${todayStr}`, 'true');
  };

  const triggerAlarmManually = (data) => {
    setIsAlarmActive(true);
    setAlarmData(data || { type: 'wake_up_alarm' });
  };

  // NOTE: the daily 5 PM fasting-intention reminder is scheduled by
  // components/FastingNotificationsManager. It used to be scheduled here as
  // well, under a different notification id, which produced two reminders at
  // 17:00. Keep exactly one scheduler.

  // Schedule iftar notification at maghrib time
  useEffect(() => {
    const breakTimeRaw = todayData?.time?.iftar || todayData?.time?.maghrib;
    if (!currentUser || !breakTimeRaw) return;

    const scheduleIftarNotification = async () => {
      try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA');

        // Check if user is fasting today (from local storage or Firestore)
        const localStatus = await AsyncStorage.getItem(`suhoor_fasting_status_${todayStr}`);
        let isFastingToday = localStatus === 'confirmed_fasting' || localStatus === 'fasting';

        if (!isFastingToday) {
          try {
            const statusSnap = await getDoc(doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${todayStr}`));
            if (statusSnap.exists()) {
              const data = statusSnap.data();
              if (data.wantsToFast || data.checkedIn) {
                isFastingToday = true;
              }
            }
          } catch (e) {
            // fallback
            isFastingToday = true;
          }
        }

        if (!isFastingToday) return;

        const [maghribH, maghribM] = breakTimeRaw.split(':').map(Number);
        if (isNaN(maghribH) || isNaN(maghribM)) return;

        const iftarTime = new Date();
        iftarTime.setHours(maghribH, maghribM, 0, 0);

        // If iftar time hasn't passed today yet
        if (iftarTime > now) {
          const lastScheduled = await AsyncStorage.getItem(`${IFTAR_NOTIFICATION_KEY}_${todayStr}`);
          if (!lastScheduled) {
            await scheduleNotification({
              semanticId: `suhoor-iftar-${todayStr}`,
              date: iftarTime,
              title: t('notifications.iftarTitle', t('fasting.iftarNotificationTitle', '🌅 Iftar Time')),
              message: t('notifications.iftarMessage', t('fasting.iftarNotificationMessage', "It's time to break your fast. May Allah accept your fasting and duas!")),
              channel: CHANNELS.iftar,
            });
            await AsyncStorage.setItem(`${IFTAR_NOTIFICATION_KEY}_${todayStr}`, iftarTime.toISOString());
            console.log('Scheduled iftar notification for:', iftarTime.toISOString());
          }
        }
      } catch (err) {
        console.error('Error scheduling iftar notification:', err);
      }
    };

    scheduleIftarNotification();
  }, [currentUser, userProfile, todayData, t]);

  // Schedule wake-up window check-in reminder
  useEffect(() => {
    if (!currentUser || !todayData?.time?.sahur) return;

    const scheduleWakeUpCheckInReminder = async () => {
      try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA');

        // Check if user already checked in today
        const checkedInKey = `suhoor_checked_in_${todayStr}`;
        const localCheckedIn = await AsyncStorage.getItem(checkedInKey);
        if (localCheckedIn === 'true') {
          // If already checked in, cancel any scheduled check-in reminder
          await cancelNotification('suhoor-checkin-reminder');
          await cancelNotification('suhoor-wakeup-start');
          return;
        }

        const scheduledKey = `${CHECKIN_NOTIFICATION_KEY}_${todayStr}`;
        const alreadyScheduled = await AsyncStorage.getItem(scheduledKey);
        if (alreadyScheduled) return;

        // Wake-up window starts at personal wake-up time or 40 mins before suhoor
        const userMinutesBefore = userProfile?.preferences?.wakeUpMinutesBeforeSuhoor || 40;
        const [sahurH, sahurM] = todayData.time.sahur.split(':').map(Number);
        if (isNaN(sahurH) || isNaN(sahurM)) return;

        const wakeUpDate = new Date();
        wakeUpDate.setHours(sahurH, sahurM - userMinutesBefore, 0, 0);

        if (wakeUpDate > now) {
          // Schedule notification at the beginning of wake-up window
          await scheduleNotification({
            semanticId: 'suhoor-wakeup-start',
            date: wakeUpDate,
            title: t('notifications.wakeUpWindowStartTitle', '⏰ Wake-Up Window Started'),
            message: t('notifications.wakeUpWindowStartMessage', "Don't forget to check in! Your wake-up window has begun."),
            channel: CHANNELS.wakeUp,
          });

          // Schedule another reminder 10 minutes into the window
          const reminderDate = new Date(wakeUpDate.getTime() + 10 * 60 * 1000);
          if (reminderDate > now) {
            await scheduleNotification({
              semanticId: 'suhoor-checkin-reminder',
              date: reminderDate,
              title: t('notifications.checkInReminderTitle', '⏰ Time to Check In'),
              message: t('notifications.checkInReminderMessage', "Don't forget to check in on the Groups tab to let your group know you're awake!"),
              channel: CHANNELS.wakeUp,
            });
          }

          await AsyncStorage.setItem(scheduledKey, wakeUpDate.toISOString());
          console.log('Scheduled wake-up window notifications for:', wakeUpDate.toISOString());
        }
      } catch (err) {
        console.error('Error scheduling wake-up check-in reminder:', err);
      }
    };

    scheduleWakeUpCheckInReminder();
  }, [currentUser, userProfile, todayData, t]);

  return (
    <AlarmContext.Provider
      value={{
        isAlarmActive,
        alarmData,
        scheduledAlarmTime,
        scheduleDailySuhoorAlarm,
        cancelDailySuhoorAlarm,
        dismissAlarm,
        triggerAlarmManually,
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
};

export default AlarmContext;
