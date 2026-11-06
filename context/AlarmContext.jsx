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

const ALARM_TYPES = new Set(['wake_up_alarm']);
const DAILY_ALARM_KEY = 'suhoor_daily_alarm_time';
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
  const { triggerRemoteBuzz, scheduleAlarm: scheduleNativeAlarm, consumeAlarmTrigger } = useNativeAlarm();

  // Reset alarm state when app comes to foreground (after swipe-close)
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('App came to foreground, resetting alarm state');
        setIsAlarmActive(false);
        setAlarmData(null);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

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

  // The user tapped "Enter PIN" on the native alarm screen (or the alarm
  // notification). The native alarm is still ringing; show the PIN overlay so
  // it can be dismissed properly. Registered after the reset effect above so it
  // wins when both fire on the same resume. Covers cold start and resume.
  // Kept in a ref: useNativeAlarm() returns fresh closures on every render, and
  // this listener must be registered exactly once.
  const consumeAlarmTriggerRef = useRef(consumeAlarmTrigger);
  useEffect(() => {
    consumeAlarmTriggerRef.current = consumeAlarmTrigger;
  }, [consumeAlarmTrigger]);

  useEffect(() => {
    let cancelled = false;

    const checkPendingTrigger = async () => {
      const consume = consumeAlarmTriggerRef.current;
      if (Platform.OS !== 'android' || typeof consume !== 'function') return;
      try {
        const trigger = await consume();
        if (cancelled || !trigger) return;
        console.log('⏰ Native alarm handed off to PIN overlay:', trigger);
        setAlarmData({
          type: trigger.alarmType === 'remote_buzz' ? 'buzz' : 'wake_up_alarm',
          fromNative: true,
          alarmId: trigger.alarmId,
        });
        setIsAlarmActive(true);
      } catch (e) {
        console.warn('Could not consume native alarm trigger:', e);
      }
    };

    checkPendingTrigger();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') checkPendingTrigger();
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

    // Check stored alarm time and reset stale alarm state on app start
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

    // Reset alarm state on mount to prevent stale triggers
    setIsAlarmActive(false);
    setAlarmData(null);

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
        await cancelNotification('suhoor-daily-alarm');

        // Cancel previous native alarm if available
        if (Platform.OS === 'android' && NativeModules && NativeModules.AlarmBridge && NativeModules.AlarmBridge.cancelAlarm) {
          try {
            await NativeModules.AlarmBridge.cancelAlarm('suhoor-daily-alarm');
          } catch (e) {}
        }

        // Reset today's dismissed status so the new alarm will fire
        const todayStr = new Date().toLocaleDateString('en-CA');
        await AsyncStorage.removeItem(`suhoor_alarm_dismissed_${todayStr}`);

        // Schedule exact native Android alarm (survives Doze, device sleep, and deep background)
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

            const ok = await scheduleNativeAlarm(
              'suhoor-daily-alarm',
              alarmDate.getTime(),
              currentUser?.uid || '',
              '',
              'wake_up',
              nativeSound,
              nativeVolume
            );
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

        const scheduledId = await scheduleNotification({
          semanticId: 'suhoor-daily-alarm',
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

        setScheduledAlarmTime(alarmDate);
        await AsyncStorage.setItem(DAILY_ALARM_KEY, alarmDate.toISOString());
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
      await cancelNotification('suhoor-daily-alarm');
      if (Platform.OS === 'android' && NativeModules && NativeModules.AlarmBridge && NativeModules.AlarmBridge.cancelAlarm) {
        try {
          await NativeModules.AlarmBridge.cancelAlarm('suhoor-daily-alarm');
        } catch (e) {}
      }
      setScheduledAlarmTime(null);
      await AsyncStorage.removeItem(DAILY_ALARM_KEY);
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
