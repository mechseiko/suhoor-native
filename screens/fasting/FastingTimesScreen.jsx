import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  PanResponder,
  Dimensions,
  RefreshControl,
  Animated,
} from 'react-native';

import { useFastingTimes } from '../../hooks/useFastingTimes';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAlarmState } from '../../context/AlarmContext';
import { hijriMonthName } from '../../config/languages';
import { db, storage } from '../../config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from '../../components/Toast';
import { getHijriDate } from '../../utils/fastingUtils';
// DocumentPicker for custom audio upload (gracefully no-ops if not installed)
let DocumentPicker;
try { DocumentPicker = require('react-native-document-picker').default; } catch (e) {}

// The wake-up window the README specifies: 45 minutes before suhoor ends by
// default, user-configurable up to two hours. Named here so the copy, the
// validation and the calculation can't drift apart the way they had.
const DEFAULT_WAKE_MINUTES = 45;
const MIN_WAKE_MINUTES = 15;
const MAX_WAKE_MINUTES = 120;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CLOCK_SIZE = Math.min(SCREEN_WIDTH - 80, 280);
const CLOCK_RADIUS = CLOCK_SIZE / 2;

const TimePickerDial = ({ value, onChange, colors }) => {
  const [angle, setAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Convert value (0-120) to angle (0-360 degrees)
    const normalizedValue = value / MAX_WAKE_MINUTES;
    const newAngle = normalizedValue * 360;
    setAngle(newAngle);
  }, [value]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      setIsDragging(true);
    },
    onPanResponderMove: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      const centerX = CLOCK_RADIUS;
      const centerY = CLOCK_RADIUS;
      
      const dx = locationX - centerX;
      const dy = locationY - centerY;
      
      // Calculate distance from center to ensure user is dragging from the edge
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = CLOCK_RADIUS * 0.5; // Minimum distance from center
      
      if (distance < minDistance) {
        return; // Ignore movements too close to center
      }
      
      // Calculate angle in degrees
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      
      // Adjust angle to start from top (90 degrees in standard math)
      angle = angle + 90;
      if (angle < 0) angle += 360;
      
      // Convert angle to value (0-120)
      const normalizedValue = angle / 360;
      const newValue = Math.round(normalizedValue * MAX_WAKE_MINUTES);
      
      setAngle(angle);
      // Enforce minimum of 15 minutes
      onChange(Math.min(Math.max(newValue, MIN_WAKE_MINUTES), MAX_WAKE_MINUTES));
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      // Snap to nearest 5-minute increment, respecting 15-min minimum
      const snappedValue = Math.max(MIN_WAKE_MINUTES, Math.round(value / 5) * 5);
      onChange(Math.min(snappedValue, MAX_WAKE_MINUTES));
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  });

  const knobX = CLOCK_RADIUS + (CLOCK_RADIUS - 20) * Math.cos((angle - 90) * Math.PI / 180);
  const knobY = CLOCK_RADIUS + (CLOCK_RADIUS - 20) * Math.sin((angle - 90) * Math.PI / 180);

  return (
    <View style={{ alignItems: 'center', marginVertical: 20 }}>
      <View
        style={{
          width: CLOCK_SIZE,
          height: CLOCK_SIZE,
          borderRadius: CLOCK_RADIUS,
          backgroundColor: colors.surfaceVariant,
          borderWidth: 2,
          borderColor: colors.border,
          position: 'relative',
        }}
        {...panResponder.panHandlers}
      >
        {/* Clock face markings */}
        {[0, 15, 30, 45, 60, 75, 90, 105, 120].map((mark) => {
          const markAngle = (mark / MAX_WAKE_MINUTES) * 360 - 90;
          const markX = CLOCK_RADIUS + (CLOCK_RADIUS - 15) * Math.cos(markAngle * Math.PI / 180);
          const markY = CLOCK_RADIUS + (CLOCK_RADIUS - 15) * Math.sin(markAngle * Math.PI / 180);
          
          return (
            <View
              key={mark}
              style={{
                position: 'absolute',
                left: markX - 3,
                top: markY - 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: mark === 0 || mark === 45 || mark === 90 || mark === 120 
                  ? colors.primary 
                  : colors.textSecondary,
              }}
            />
          );
        })}

        {/* Progress arc */}
        <View
          style={{
            position: 'absolute',
            width: CLOCK_SIZE,
            height: CLOCK_SIZE,
            borderRadius: CLOCK_RADIUS,
            borderWidth: 4,
            borderColor: 'transparent',
            borderTopColor: colors.primary,
            borderRightColor: angle > 90 ? colors.primary : 'transparent',
            borderBottomColor: angle > 180 ? colors.primary : 'transparent',
            borderLeftColor: angle > 270 ? colors.primary : 'transparent',
            transform: [{ rotate: `${angle}deg` }],
          }}
        />

        {/* Draggable knob */}
        <View
          style={{
            position: 'absolute',
            left: knobX - 12,
            top: knobY - 12,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.primary,
            borderWidth: 3,
            borderColor: colors.white,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}
        />

        {/* Center display */}
        <View
          style={{
            position: 'absolute',
            top: CLOCK_RADIUS - 30,
            left: CLOCK_RADIUS - 40,
            width: 80,
            height: 60,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>
            {value}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            minutes
          </Text>
        </View>
      </View>
      
      <Text style={{ marginTop: 12, fontSize: 12, color: colors.textSecondary }}>
        Drag to select minutes before suhoor
      </Text>
    </View>
  );
};

export const FastingTimesScreen = () => {
  const { currentUser, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { t, locale, formatDate, formatTime, isRTL } = useLanguage();
  const { todayData, loading, error, location } = useFastingTimes();
  const { scheduleDailySuhoorAlarm } = useAlarmState();
  const [personalWakeUpMinutes, setPersonalWakeUpMinutes] = useState(DEFAULT_WAKE_MINUTES);
  const [isSaving, setIsSaving] = useState(false);
  // Alarm audio state
  const [alarmAudioMode, setAlarmAudioMode] = useState('default'); // 'default' | 'custom'
  const [customAudioUrl, setCustomAudioUrl] = useState(null);
  const [customAudioName, setCustomAudioName] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');
  const [refreshing, setRefreshing] = useState(false);


  const triggerToast = (msg, type) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Clear cached fasting times so useFastingTimes re-fetches
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('suhoor_fasting_times');
      // Also clear saved location so GPS is retried
      const { clearUserLocation } = require('../../utils/location');
      await clearUserLocation();
    } catch {}
    // The hook re-runs on location change; give it a moment then stop spinner
    setTimeout(() => setRefreshing(false), 1500);
  }, []);


  // Load user's preferred wake-up time
  useEffect(() => {
    const loadWakeUpPreference = async () => {
      if (!currentUser) return;
      try {
        const profileRef = doc(db, 'profiles', currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const pref = profileSnap.data().preferences?.wakeUpMinutesBeforeSuhoor;
          if (pref) {
            setPersonalWakeUpMinutes(pref);
          }
        }
      } catch (err) {
        console.error('Error loading wake-up preference:', err);
      }
    };
    loadWakeUpPreference();
  }, [currentUser]);

  // Load alarm audio preference
  useEffect(() => {
    const loadAudioPreference = async () => {
      if (!currentUser) return;
      try {
        const profileRef = doc(db, 'profiles', currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          const mode = data.preferences?.alarmAudioMode || 'default';
          const url = data.preferences?.customAlarmAudioUrl || null;
          const name = data.preferences?.customAlarmAudioName || '';
          setAlarmAudioMode(mode);
          setCustomAudioUrl(url);
          setCustomAudioName(name);
        }
      } catch (err) {
        console.error('Error loading audio preference:', err);
      }
    };
    loadAudioPreference();
  }, [currentUser]);

  const handlePickAndUploadAudio = async () => {
    if (!DocumentPicker) {
      Alert.alert('Not available', 'Document picker is not installed in this build.');
      return;
    }
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.audio],
      });
      const file = result[0];
      if (!file) return;

      const MAX_MB = 10;
      if (file.size && file.size > MAX_MB * 1024 * 1024) {
        triggerToast(`Audio file must be under ${MAX_MB}MB.`, 'error');
        return;
      }

      setIsUploadingAudio(true);
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `alarm_audio/${currentUser.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      const profileRef = doc(db, 'profiles', currentUser.uid);
      await updateDoc(profileRef, {
        'preferences.alarmAudioMode': 'custom',
        'preferences.customAlarmAudioUrl': downloadUrl,
        'preferences.customAlarmAudioName': file.name,
        'preferences.alarmVolume': 1.0, // Set to maximum volume
      });

      setAlarmAudioMode('custom');
      setCustomAudioUrl(downloadUrl);
      setCustomAudioName(file.name);
      triggerToast('Custom alarm audio saved at maximum volume!', 'success');
    } catch (err) {
      if (DocumentPicker.isCancel(err)) return;
      console.error('Audio upload error:', err);
      triggerToast('Failed to upload audio. Try again.', 'error');
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleSelectDefaultAudio = async () => {
    if (!currentUser) return;
    try {
      const profileRef = doc(db, 'profiles', currentUser.uid);
      await updateDoc(profileRef, {
        'preferences.alarmAudioMode': 'default',
      });
      setAlarmAudioMode('default');
      triggerToast('Using default Suhoor alarm sound.', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveWakeUpTime = async () => {
    if (!currentUser) return;

    if (
      personalWakeUpMinutes < MIN_WAKE_MINUTES ||
      personalWakeUpMinutes > MAX_WAKE_MINUTES
    ) {
      triggerToast(
        t('fastingTimes.rangeError', { min: MIN_WAKE_MINUTES, max: MAX_WAKE_MINUTES }),
        'error'
      );
      return;
    }

    setIsSaving(true);
    try {
      const profileRef = doc(db, 'profiles', currentUser.uid);
      await updateDoc(profileRef, {
        'preferences.wakeUpMinutesBeforeSuhoor': personalWakeUpMinutes,
      });

      // Schedule background alarm for Suhoor wake-up
      if (todayData?.suhoor_time && scheduleDailySuhoorAlarm) {
        const [hours, minutes] = todayData.suhoor_time.split(':').map(Number);
        const alarmDate = new Date();
        alarmDate.setHours(hours, minutes - personalWakeUpMinutes, 0, 0);
        if (alarmDate.getTime() < Date.now()) {
          alarmDate.setDate(alarmDate.getDate() + 1);
        }
        await scheduleDailySuhoorAlarm(
          alarmDate,
          `Suhoor Wake Up (${personalWakeUpMinutes}m before Fajr)`
        );
      }

      triggerToast(t('fastingTimes.saveSuccess'), 'success');
    } catch (err) {
      console.error('Error saving wake-up time:', err);
      triggerToast(t('fastingTimes.saveError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateWakeUpTime = (suhoorTime, minutesBefore) => {
    if (!suhoorTime) return '--:--';
    const [hours, minutes] = suhoorTime.split(':').map(Number);
    const suhoorDate = new Date();
    suhoorDate.setHours(hours, minutes, 0, 0);
    const wakeUpDate = new Date(suhoorDate.getTime() - minutesBefore * 60000);
    // 12h/24h and the AM/PM wording follow the chosen language, not en-US.
    return formatTime(wakeUpDate, { hour: '2-digit', minute: '2-digit' });
  };

  const today = new Date();
  const hijri = getHijriDate(today);


  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 14, fontWeight: '500', color: colors.textSecondary }}>
            {t('fastingTimes.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={{ marginTop: 16, fontSize: 17, fontWeight: '700', textAlign: 'center', color: colors.text }}>
            {t('fastingTimes.loadError')}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13, textAlign: 'center', color: colors.textSecondary }}>{error}</Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={{
              marginTop: 20,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Retry</Text>
          </TouchableOpacity>
          <Text style={{ marginTop: 12, fontSize: 11, color: colors.textSecondary, textAlign: 'center' }}>
            Pull down to refresh or tap Retry.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const suhoorTime = todayData?.time?.sahur || '--:--';
  const iftarTime = todayData?.time?.iftar || '--:--';
  const defaultWakeUp = calculateWakeUpTime(suhoorTime, DEFAULT_WAKE_MINUTES);
  const personalWakeUp = calculateWakeUpTime(suhoorTime, personalWakeUpMinutes);

  /**
   * The location notice, shown when no location is available or when using
   * a fallback location. When source is 'none', the user needs to set their
   * location in settings. When source is 'profile', we're using their saved
   * default location from their profile.
   */
  const locationStatus =
    location?.loaded && location.source === 'none'
      ? {
          icon: 'warning',
          color: colors.warning,
          message: location.error || t('fastingTimes.noLocationAvailable'),
        }
      : location?.loaded && location.source === 'profile'
      ? {
          icon: 'information-circle',
          color: colors.primary,
          message: t('fastingTimes.usingProfileLocation'),
        }
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
      
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >

        {/* Location Status */}
        {locationStatus && (
          <View
            style={{
              backgroundColor: colors.surfaceVariant,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              columnGap: 10,
            }}
          >
            <Ionicons name={locationStatus.icon} size={20} color={locationStatus.color} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>
              {locationStatus.message}
            </Text>
          </View>
        )}

        {/* Date Section */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              columnGap: 10,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Ionicons name="calendar" size={24} color={colors.primary} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('common.todaysDate')}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, color: colors.textSecondary }}>
                {t('fastingTimes.hijriDate')}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 22, color: colors.text }}>
                {t('fastingTimes.hijriToday', {
                  day: hijri.day,
                  month: hijriMonthName(today, locale, hijri.month),
                  year: hijri.year,
                })}
              </Text>
            </View>

            <View style={{ width: 1, height: 48, marginHorizontal: 16, backgroundColor: colors.border }} />

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, color: colors.textSecondary }}>
                {t('fastingTimes.gregorianDate')}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 22, color: colors.text }}>
                {formatDate(today, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Fasting Times Section */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              columnGap: 10,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Ionicons name="sunny" size={24} color={colors.secondary} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
              {t('nav.fastingTimes')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 10,
                  backgroundColor: colors.primary + '14',
                }}
              >
                <Ionicons name="moon" size={20} color={colors.secondary} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, color: colors.textSecondary }}>
                  {t('fastingTimes.suhoorEnds')}
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{suhoorTime}</Text>
              </View>
            </View>

            <View style={{ width: 1, height: 48, marginHorizontal: 16, backgroundColor: colors.border }} />

            <View style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 10,
                  backgroundColor: colors.error + '14',
                }}
              >
                <Ionicons name="sunny" size={20} color={colors.error} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, color: colors.textSecondary }}>
                  {t('fastingTimes.iftarBegins')}
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{iftarTime}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Wake Up Times Section */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              columnGap: 10,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Ionicons name="alarm" size={24} color={colors.accent} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
              {t('fastingTimes.wakeUpTimes')}
            </Text>
          </View>

          <View style={{ rowGap: 18 }}>
            <View style={{ rowGap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {t('fastingTimes.defaultWakeUp')}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {t('fastingTimes.defaultWakeUpSub', { minutes: DEFAULT_WAKE_MINUTES })}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.primary, marginTop: 4 }}>{defaultWakeUp}</Text>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

            <View style={{ rowGap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {t('fastingTimes.personalWakeUp')}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {t('fastingTimes.personalWakeUpSub')}
              </Text>
              <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.textSecondary }}>
                {t('fastingTimes.allowedRange', {
                  min: MIN_WAKE_MINUTES,
                  max: MAX_WAKE_MINUTES,
                })}
              </Text>

              <TimePickerDial 
                value={personalWakeUpMinutes} 
                onChange={setPersonalWakeUpMinutes} 
                colors={colors} 
              />

              <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center', color: colors.accent }}>
                {t('fastingTimes.calculated', { time: personalWakeUp })}
              </Text>
            </View>
          </View>
        </View>

        {/* Alarm Audio Section */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Ionicons name="musical-notes" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 17, color: colors.text }}>Alarm Sound</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Choose what plays when your Suhoor alarm rings</Text>
            </View>
          </View>

          {/* Default option */}
          <TouchableOpacity
            onPress={handleSelectDefaultAudio}
            style={{
              flexDirection: 'row', alignItems: 'center', columnGap: 12,
    rowGap: 12,
              paddingVertical: 14, paddingHorizontal: 14,
              borderRadius: 12, marginBottom: 10,
              borderWidth: 1.5,
              borderColor: alarmAudioMode === 'default' ? colors.primary : colors.border,
              backgroundColor: alarmAudioMode === 'default' ? colors.primary + '08' : colors.surfaceVariant,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: alarmAudioMode === 'default' ? colors.primary + '20' : colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="notifications" size={20} color={alarmAudioMode === 'default' ? colors.primary : colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>Default Suhoor Alarm</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Built-in gentle wake-up chime</Text>
            </View>
            {alarmAudioMode === 'default' && (
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>

          {/* Custom audio option */}
          <TouchableOpacity
            onPress={handlePickAndUploadAudio}
            disabled={isUploadingAudio}
            style={{
              flexDirection: 'row', alignItems: 'center', columnGap: 12,
    rowGap: 12,
              paddingVertical: 14, paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: alarmAudioMode === 'custom' ? colors.accent : colors.border,
              backgroundColor: alarmAudioMode === 'custom' ? colors.accent + '08' : colors.surfaceVariant,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: alarmAudioMode === 'custom' ? colors.accent + '20' : colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {isUploadingAudio
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Ionicons name="cloud-upload-outline" size={20} color={alarmAudioMode === 'custom' ? colors.accent : colors.textSecondary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>
                {alarmAudioMode === 'custom' && customAudioName ? customAudioName : 'Upload Custom Audio'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {alarmAudioMode === 'custom' ? 'Tap to change \u00b7 MP3, M4A, WAV (max 10MB)' : 'Pick an audio file from your device (max 10MB)'}
              </Text>
            </View>
            {alarmAudioMode === 'custom' && (
              <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
            style={[
              { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, marginTop: 8 },
              { backgroundColor: colors.primary },
            ]}
            onPress={handleSaveWakeUpTime}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>
                  {t('fastingTimes.saveWakeUp')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
    </SafeAreaView>
  );
};


export default FastingTimesScreen;
