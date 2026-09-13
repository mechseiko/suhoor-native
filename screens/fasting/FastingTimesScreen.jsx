import React, { useState, useEffect, useRef } from 'react';
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
try { DocumentPicker = require('react-native-document-picker').default; } catch {}

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

  useEffect(() => {
    // Convert value (0-120) to angle (0-360 degrees)
    const normalizedValue = value / MAX_WAKE_MINUTES;
    const newAngle = normalizedValue * 360;
    setAngle(newAngle);
  }, [value]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      const centerX = CLOCK_RADIUS;
      const centerY = CLOCK_RADIUS;
      
      const dx = locationX - centerX;
      const dy = locationY - centerY;
      
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
      // Snap to nearest 5-minute increment, respecting 15-min minimum
      const snappedValue = Math.max(MIN_WAKE_MINUTES, Math.round(value / 5) * 5);
      onChange(Math.min(snappedValue, MAX_WAKE_MINUTES));
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

  const triggerToast = (msg, type) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

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
      });

      setAlarmAudioMode('custom');
      setCustomAudioUrl(downloadUrl);
      setCustomAudioName(file.name);
      triggerToast('Custom alarm audio saved!', 'success');
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
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 justify-center items-center p-5">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-base font-medium" style={{ color: colors.textSecondary }}>
            {t('fastingTimes.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 justify-center items-center p-5">
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text className="mt-4 text-lg font-bold text-center" style={{ color: colors.text }}>
            {t('fastingTimes.loadError')}
          </Text>
          <Text className="mt-2 text-sm text-center" style={{ color: colors.textSecondary }}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const suhoorTime = todayData?.time?.sahur || '--:--';
  const iftarTime = todayData?.time?.iftar || '--:--';
  const defaultWakeUp = calculateWakeUpTime(suhoorTime, DEFAULT_WAKE_MINUTES);
  const personalWakeUp = calculateWakeUpTime(suhoorTime, personalWakeUpMinutes);

  /**
   * The location notice, shown only when the times are NOT for where the user
   * is — that is, when `getCurrentCoordinates` fell back to Lagos because device
   * location was unavailable or denied. Device and saved-location sources say
   * nothing: the times are already correct, so a banner there is noise.
   *
   * The underlying permission/GPS error is deliberately not surfaced; from the
   * user's side the only actionable fact is that their location is off.
   */
  const locationStatus =
    location?.loaded && location.source === 'default'
      ? {
          icon: 'warning',
          color: colors.warning,
          message: t('fastingTimes.usingDefaultLocation'),
        }
      : null;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
      
      <ScrollView contentContainerClassName="p-4" showsVerticalScrollIndicator={false}>
        {/* Location Status */}
        {locationStatus && (
          <View className="rounded-xl p-4 mb-4 flex-row items-center gap-3" style={{ backgroundColor: colors.surfaceVariant }}>
            <Ionicons name={locationStatus.icon} size={20} color={locationStatus.color} />
            <Text className="text-sm flex-1" style={{ color: colors.textSecondary }}>
              {locationStatus.message}
            </Text>
          </View>
        )}

        {/* Date Section */}
        <View className="rounded-2xl p-5 mb-4 shadow-sm border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row items-center gap-3 mb-5 pb-4 border-b" style={{ borderBottomColor: colors.border }}>
            <Ionicons name="calendar" size={24} color={colors.primary} />
            <Text className="text-lg font-bold" style={{ color: colors.text }}>{t('common.todaysDate')}</Text>
          </View>

          <View className="flex-row justify-between">
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase mb-2" style={{ color: colors.textSecondary }}>
                {t('fastingTimes.hijriDate')}
              </Text>
              <Text className="text-base font-semibold leading-5" style={{ color: colors.text }}>
                {t('fastingTimes.hijriToday', {
                  day: hijri.day,
                  month: hijriMonthName(today, locale, hijri.month),
                  year: hijri.year,
                })}
              </Text>
            </View>

            <View className="w-1 mx-4" style={{ backgroundColor: colors.border }} />

            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase mb-2" style={{ color: colors.textSecondary }}>
                {t('fastingTimes.gregorianDate')}
              </Text>
              <Text className="text-base font-semibold leading-5" style={{ color: colors.text }}>
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
        <View className="rounded-2xl p-5 mb-4 shadow-sm border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row items-center gap-3 mb-5 pb-4 border-b" style={{ borderBottomColor: colors.border }}>
            <Ionicons name="sunny" size={24} color={colors.secondary} />
            <Text className="text-lg font-bold" style={{ color: colors.text }}>
              {t('nav.fastingTimes')}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <View className="flex-1 items-center">
              <View className="w-12 h-12 rounded-full justify-center items-center mb-3" style={{ backgroundColor: colors.primary + '14' }}>
                <Ionicons name="moon" size={20} color={colors.secondary} />
              </View>
              <View className="items-center">
                <Text className="text-xs font-semibold uppercase mb-1" style={{ color: colors.textSecondary }}>
                  {t('fastingTimes.suhoorEnds')}
                </Text>
                <Text className="text-2xl font-extrabold" style={{ color: colors.text }}>{suhoorTime}</Text>
              </View>
            </View>

            <View className="w-1 mx-4" style={{ backgroundColor: colors.border }} />

            <View className="flex-1 items-center">
              <View className="w-12 h-12 rounded-full justify-center items-center mb-3" style={{ backgroundColor: colors.error + '14' }}>
                <Ionicons name="sunny" size={20} color={colors.error} />
              </View>
              <View className="items-center">
                <Text className="text-xs font-semibold uppercase mb-1" style={{ color: colors.textSecondary }}>
                  {t('fastingTimes.iftarBegins')}
                </Text>
                <Text className="text-2xl font-extrabold" style={{ color: colors.text }}>{iftarTime}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Wake Up Times Section */}
        <View className="rounded-2xl p-5 mb-4 shadow-sm border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row items-center gap-3 mb-5 pb-4 border-b" style={{ borderBottomColor: colors.border }}>
            <Ionicons name="alarm" size={24} color={colors.accent} />
            <Text className="text-lg font-bold" style={{ color: colors.text }}>
              {t('fastingTimes.wakeUpTimes')}
            </Text>
          </View>

          <View className="gap-5">
            <View className="gap-2">
              <Text className="text-sm font-bold" style={{ color: colors.text }}>
                {t('fastingTimes.defaultWakeUp')}
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t('fastingTimes.defaultWakeUpSub', { minutes: DEFAULT_WAKE_MINUTES })}
              </Text>
              <Text className="text-3xl font-black" style={{ color: colors.primary }}>{defaultWakeUp}</Text>
            </View>

            <View className="w-1 mx-4" style={{ backgroundColor: colors.border }} />

            <View className="gap-2">
              <Text className="text-sm font-bold" style={{ color: colors.text }}>
                {t('fastingTimes.personalWakeUp')}
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t('fastingTimes.personalWakeUpSub')}
              </Text>
              <Text className="text-xs italic" style={{ color: colors.textSecondary }}>
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

              <Text className="text-sm font-semibold mt-1 text-center" style={{ color: colors.accent }}>
                {t('fastingTimes.calculated', { time: personalWakeUp })}
              </Text>
            </View>
          </View>
        </View>

        {/* Alarm Audio Section */}
        <View className="rounded-2xl p-5 mb-4 shadow-sm border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row items-center gap-3 mb-5 pb-4 border-b" style={{ borderBottomColor: colors.border }}>
            <Ionicons name="musical-notes" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Alarm Sound</Text>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>Choose what plays when your Suhoor alarm rings</Text>
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
            className="flex-row items-center justify-center h-12 rounded-xl gap-2 mt-2"
            style={{ backgroundColor: colors.primary }}
            onPress={handleSaveWakeUpTime}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.white} />
                <Text className="font-bold text-base" style={{ color: colors.white }}>
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
