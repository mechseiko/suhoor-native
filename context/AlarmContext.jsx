import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  subscribeToNotifications,
  scheduleNotification,
  cancelNotification,
  CHANNELS,
} from '../services/notifications';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALARM_TYPES = new Set(['wake_up_alarm', 'recheck_alarm', 'buzz']);
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

  const scheduleDailySuhoorAlarm = useCallback(
    async (targetTime, label = 'Suhoor Wake Up') => {
      try {
        if (!targetTime) return false;
        const alarmDate = targetTime instanceof Date ? targetTime : new Date(targetTime);

        // Cancel previous scheduled daily alarm
        await cancelNotification('suhoor-daily-alarm');

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

        if (scheduledId) {
          setScheduledAlarmTime(alarmDate);
          await AsyncStorage.setItem(DAILY_ALARM_KEY, alarmDate.toISOString());
          return true;
        }
        return false;
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
      setScheduledAlarmTime(null);
      await AsyncStorage.removeItem(DAILY_ALARM_KEY);
      return true;
    } catch (err) {
      console.error('Failed to cancel daily Suhoor alarm:', err);
      return false;
    }
  }, []);

  const dismissAlarm = () => {
    setIsAlarmActive(false);
    setAlarmData(null);
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
