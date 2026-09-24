import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';
import {
  subscribeToNotifications,
  scheduleNotification,
  cancelNotification,
  CHANNELS,
} from '../services/notifications';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALARM_TYPES = new Set(['wake_up_alarm', 'buzz']);
const DAILY_ALARM_KEY = 'suhoor_daily_alarm_time';

const AlarmContext = createContext({});

export const useAlarmState = () => useContext(AlarmContext);

export const AlarmProvider = ({ children }) => {
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [alarmData, setAlarmData] = useState(null);
  const [scheduledAlarmTime, setScheduledAlarmTime] = useState(null);
  const { currentUser, userProfile } = useAuth();
  const { on, off } = useSocket();

  useEffect(() => {
    const handleGetBuzzed = (data) => {
      console.log('🔔 Received incoming buzz:', data);
      const buzzAllowed = userProfile?.preferences?.buzzNotifications ?? true;
      if (!buzzAllowed) {
        console.log('🚫 Buzz ignored: user disabled group member buzz alerts');
        return;
      }
      setIsAlarmActive(true);
      setAlarmData({
        type: 'buzz',
        ...data,
      });
    };

    if (on) {
      on('get-buzzed', handleGetBuzzed);
    }

    return () => {
      if (off) {
        off('get-buzzed', handleGetBuzzed);
      }
    };
  }, [on, off, userProfile]);

  useEffect(() => {
    // Subscribe to incoming local/push notification triggers
    const unsubscribe = subscribeToNotifications((data) => {
      if (data && ALARM_TYPES.has(data.type)) {
        setIsAlarmActive(true);
        setAlarmData(data);
      }
    });

    // Check stored alarm time
    AsyncStorage.getItem(DAILY_ALARM_KEY).then((timeStr) => {
      if (timeStr) setScheduledAlarmTime(new Date(timeStr));
    }).catch(() => {});

    return unsubscribe;
  }, [currentUser]);

  // Foreground heartbeat: if scheduled alarm time arrives while app is open, activate alarm immediately
  useEffect(() => {
    if (!scheduledAlarmTime || isAlarmActive) return;

    const checkAlarmTrigger = async () => {
      const now = Date.now();
      const alarmMs = scheduledAlarmTime.getTime();
      const diff = now - alarmMs;

      // Within 2.5 hours past alarm time, trigger if not already dismissed today
      if (diff >= 0 && diff < 2.5 * 3600 * 1000) {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const dismissedKey = `suhoor_alarm_dismissed_${todayStr}`;
        const alreadyDismissed = await AsyncStorage.getItem(dismissedKey);
        if (!alreadyDismissed) {
          setIsAlarmActive(true);
          setAlarmData({
            type: 'wake_up_alarm',
            time: scheduledAlarmTime.toISOString(),
          });
        }
      }
    };

    const interval = setInterval(checkAlarmTrigger, 2000);
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
        if (Platform.OS === 'android' && NativeModules.AlarmBridge?.cancelAlarm) {
          try {
            await NativeModules.AlarmBridge.cancelAlarm('suhoor-daily-alarm');
          } catch (e) {}
        }

        // Reset today's dismissed status so the new alarm will fire
        const todayStr = new Date().toLocaleDateString('en-CA');
        await AsyncStorage.removeItem(`suhoor_alarm_dismissed_${todayStr}`);

        // Schedule exact native Android alarm (survives Doze, device sleep, and deep background)
        if (Platform.OS === 'android' && NativeModules.AlarmBridge?.scheduleAlarm) {
          try {
            await NativeModules.AlarmBridge.scheduleAlarm(
              'suhoor-daily-alarm',
              alarmDate.getTime(),
              currentUser?.uid || '',
              '',
              'wake_up'
            );
            console.log('⏰ Native exact alarm scheduled for:', alarmDate.toISOString());
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
          title: '⏰ Suhoor Time!',
          message:
            label ||
            'Wake up for Sahur and your blessed fast. May Allah accept your worship!',
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
      if (Platform.OS === 'android' && NativeModules.AlarmBridge?.cancelAlarm) {
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
    const todayStr = new Date().toLocaleDateString('en-CA');
    await AsyncStorage.setItem(`suhoor_alarm_dismissed_${todayStr}`, 'true');
  };

  const triggerAlarmManually = (data) => {
    setIsAlarmActive(true);
    setAlarmData(data || { type: 'wake_up_alarm' });
  };

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
