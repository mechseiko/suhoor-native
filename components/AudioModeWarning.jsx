import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, Button } from './ui';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { scheduleNotification } from '../services/notifications';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFastingTimes } from '../hooks/useFastingTimes';

export const AudioModeWarning = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { todayData } = useFastingTimes();
  const [isSilent, setIsSilent] = useState(false);
  const [isDND, setIsDND] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      checkAudioMode();
      
      // Check audio mode every 30 seconds
      const interval = setInterval(checkAudioMode, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (todayData && (isSilent || isDND)) {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Check if we're in the critical period (8 PM to Fajr)
      const fajrTime = todayData.fajr ? new Date(todayData.fajr) : new Date();
      fajrTime.setHours(4, 30, 0, 0); // Default to 4:30 AM if no specific time
      
      const eightPM = new Date();
      eightPM.setHours(20, 0, 0, 0);
      
      if (currentHour >= 20 || currentHour < fajrTime.getHours()) {
        setShowWarning(true);
        
        // Send notification if not already sent
        if (!notificationSent) {
          sendSilentModeNotification();
          setNotificationSent(true);
        }
      } else {
        setShowWarning(false);
        setNotificationSent(false);
      }
    }
  }, [isSilent, isDND, todayData]);

  const checkAudioMode = async () => {
    if (Platform.OS === 'android') {
      try {
        // This would need a native module to check actual audio mode
        // For now, we'll show the warning if the user hasn't explicitly dismissed it
        const hasDismissedWarning = await AsyncStorage.getItem('suhoor_audio_warning_dismissed');
        if (!hasDismissedWarning) {
          setIsSilent(true); // Default to showing warning until we have native detection
        }
      } catch (error) {
        console.error('Error checking audio mode:', error);
      }
    }
  };

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
      Alert.alert('Error', 'Could not open settings');
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