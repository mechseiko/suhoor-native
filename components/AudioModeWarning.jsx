import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, Button } from './ui';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { scheduleNotification } from '../services/notifications';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFastingTimes } from '../hooks/useFastingTimes';

// Safe import for the volume manager
let VolumeManager = null;
let RINGER_MODE = null;
try {
  const VolumeModule = require('react-native-volume-manager');
  VolumeManager = VolumeModule.VolumeManager;
  RINGER_MODE = VolumeModule.RINGER_MODE;
} catch (e) {
  // Library not installed, fail silently
}

export const AudioModeWarning = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { todayData } = useFastingTimes();
  const [isSilent, setIsSilent] = useState(false);
  const [isDND, setIsDND] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  // Check ringer mode and DND status
  useEffect(() => {
    if (Platform.OS !== 'android' || !VolumeManager) return;

    let isMounted = true;
    let subscription = null;

    const checkStatus = async () => {
      try {
        // 1. Get Ringer Mode (silent, vibrate, normal)
        const mode = await VolumeManager.getRingerMode();
        if (isMounted) {
          setIsSilent(mode === RINGER_MODE.silent || mode === RINGER_MODE.vibrate);
        }

        // 2. Check if device is in a silent state (includes DND)
        const deviceSilent = await VolumeManager.isAndroidDeviceSilent();
        if (isMounted) {
          setIsDND(deviceSilent);
        }
      } catch (e) {
        // Silently fail
      }
    };

    // Subscribe to real-time changes
    const subscribe = () => {
      try {
        subscription = VolumeManager.addRingerListener((status) => {
          if (isMounted) {
            // Correct property is status.ringerMode
            const currentMode = status.ringerMode;
            setIsSilent(currentMode === RINGER_MODE.silent || currentMode === RINGER_MODE.vibrate);
            
            // Re-check DND when ringer mode changes
            VolumeManager.isAndroidDeviceSilent().then((silent) => {
              if (isMounted) setIsDND(silent);
            }).catch(() => {});
          }
        });
      } catch (e) {}
    };

    checkStatus();
    subscribe();

    // Fallback polling every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (subscription) {
        try {
          VolumeManager.removeRingerListener(subscription);
        } catch (e) {}
      }
    };
  }, []);

  // Show warning logic (8 PM to Fajr)
  useEffect(() => {
    if (todayData && (isSilent || isDND)) {
      const now = new Date();
      const currentHour = now.getHours();
      
      const fajrTime = todayData.fajr ? new Date(todayData.fajr) : new Date();
      fajrTime.setHours(4, 30, 0, 0);
      
      if (currentHour >= 20 || currentHour < fajrTime.getHours()) {
        setShowWarning(true);
        
        if (!notificationSent) {
          sendSilentModeNotification();
          setNotificationSent(true);
        }
      } else {
        setShowWarning(false);
        setNotificationSent(false);
      }
    } else {
      setShowWarning(false);
    }
  }, [isSilent, isDND, todayData, notificationSent]);

  const sendSilentModeNotification = async () => {
    try {
      await scheduleNotification({
        semanticId: 'audio_mode_warning',
        date: new Date(Date.now() + 1000),
        title: 'Is your phone in silent mode?',
        message: 'Your phone may be in silent or DND mode. Alarms may not sound. Please check your audio settings.',
        channel: { id: 'suhoor-wake-up', name: 'Suhoor Wake Up' },
      });
    } catch (error) {
      console.error('Error sending audio mode notification:', error);
    }
  };

  const handleDismiss = async () => {
    setShowWarning(false);
    await AsyncStorage.setItem('suhoor_audio_warning_dismissed', 'true');
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert(t('common.error'), t('common.settingsError'));
    });
  };

  if (!showWarning || Platform.OS !== 'android') return null;

  return (
    <View style={[styles.container, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
      <View style={styles.content}>
        <Ionicons name="warning-outline" size={24} color="#D97706" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: '#92400E' }]}>
            {t('audioMode.warningTitle')}
          </Text>
          <Text style={[styles.message, { color: '#B45309' }]}>
            {t('audioMode.warningMessage')}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          title={t('common.dismiss')}
          onPress={handleDismiss}
          variant="outline"
          style={[styles.button, { borderColor: '#D97706' }]}
          textStyle={{ color: '#92400E' }}
        />
        <Button
          title={t('audioMode.openSettings')}
          onPress={handleOpenSettings}
          variant="secondary"
          style={[styles.button, { backgroundColor: '#F59E0B' }]}
          textStyle={{ color: '#FFFFFF' }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Quicksand-Regular',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
  },
});

export default AudioModeWarning;