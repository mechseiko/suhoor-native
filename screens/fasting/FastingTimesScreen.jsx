import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';

import { useFastingTimes } from '../../hooks/useFastingTimes';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAlarmState } from '../../context/AlarmContext';
import { hijriMonthName } from '../../config/languages';
import { db } from '../../config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from '../../components/Toast';
import { getHijriDate } from '../../utils/fastingUtils';

const DEFAULT_WAKE_MINUTES = 45;
const MIN_WAKE_MINUTES = 15;
const MAX_WAKE_MINUTES = 120;

export const FastingTimesScreen = ({ navigation }) => {
  const { currentUser, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { t, locale, formatDate, formatTime } = useLanguage();
  const { todayData, loading, error, location, checkWakeUpWindow, setRefreshKey } = useFastingTimes();
  const { scheduleDailySuhoorAlarm } = useAlarmState();

  const [personalWakeUpMinutes, setPersonalWakeUpMinutes] = useState(DEFAULT_WAKE_MINUTES);
  const [isSaving, setIsSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date()); // Used to trigger re-renders for lock state

  // 1-second ticker to ensure the lock/unlock happens exactly on time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerToast = (msg, type) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('suhoor_fasting_times');
      const { clearUserLocation } = require('../../utils/location');
      await clearUserLocation();
      // Force a re-fetch by incrementing the key
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setRefreshing(false), 500);
    } catch {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [setRefreshKey]);

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

  const handleSaveWakeUpTime = async () => {
    if (!currentUser) return;

    if (personalWakeUpMinutes < MIN_WAKE_MINUTES || personalWakeUpMinutes > MAX_WAKE_MINUTES) {
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

      // Schedule background alarm
      if (todayData?.time?.sahur && scheduleDailySuhoorAlarm) {
        const [hours, minutes] = todayData.time.sahur.split(':').map(Number);
        const alarmDate = new Date();
        alarmDate.setHours(hours, minutes - personalWakeUpMinutes, 0, 0);
        
        // If the time has already passed today, schedule for tomorrow
        if (alarmDate.getTime() < Date.now()) {
          alarmDate.setDate(alarmDate.getDate() + 1);
        }
        
        await scheduleDailySuhoorAlarm(
          alarmDate,
          t('fastingTimes.alarmLabel', { minutes: personalWakeUpMinutes })
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
    return formatTime(wakeUpDate, { hour: '2-digit', minute: '2-digit' });
  };

  const today = new Date();
  const hijri = getHijriDate(today);
  const suhoorTime = todayData?.time?.sahur || '--:--';
  const iftarTime = todayData?.time?.iftar || '--:--';
  const personalWakeUp = calculateWakeUpTime(suhoorTime, personalWakeUpMinutes);

  // --- LOCK LOGIC ---
  // Locked from 12:00 Midnight until Suhoor ends.
  const isPickerLocked = () => {
    if (!todayData?.time?.sahur) return false; // Don't lock if we don't have the time yet
    
    const now = currentTime;
    const currentHour = now.getHours();
    
    // If it's past noon, it's definitely unlocked (evening)
    if (currentHour >= 12) return false;

    // It's between midnight and noon. Check if we are past Suhoor.
    const [suhoorH, suhoorM] = todayData.time.sahur.split(':').map(Number);
    const suhoorDate = new Date();
    suhoorDate.setHours(suhoorH, suhoorM, 0, 0);

    // If it's currently BEFORE Suhoor, it's locked.
    // If it's AFTER Suhoor (e.g. 6:00 AM), it's unlocked for tomorrow.
    return now < suhoorDate;
  };

  const locked = isPickerLocked();

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
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
        {/* Location Warning */}
        {locationStatus && location.source === 'none' && (
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

        {/* Alarms Section */}
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

          {locked ? (
            /* LOCKED STATE */
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primary + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="lock-closed" size={32} color={colors.primary} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.text,
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                Alarm Time Locked
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                  paddingHorizontal: 20,
                }}
              >
                Your alarm time is saved as {personalWakeUp}. You can only edit it before midnight. The selector will reappear after Suhoor ends at {suhoorTime}.
              </Text>
            </View>
          ) : (
            /* UNLOCKED STATE */
            <View style={{ rowGap: 18 }}>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
              <View style={{ rowGap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {t('fastingTimes.personalWakeUp')}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {t('fastingTimes.personalWakeUpSub')}
                </Text>

                <View style={{ alignItems: 'center', marginVertical: 20, paddingHorizontal: 10 }}>
                  <Text style={{ fontSize: 32, fontWeight: '900', color: colors.primary, marginBottom: 4 }}>
                    {personalWakeUp}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, fontWeight: '500' }}>
                    {t('fastingTimes.minutesBeforeValue', { minutes: personalWakeUpMinutes })}
                  </Text>
                  
                  <View style={{ width: '100%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
                      <TouchableOpacity
                        onPress={() =>
                          setPersonalWakeUpMinutes((prev) =>
                            Math.max(MIN_WAKE_MINUTES, prev - 5)
                          )
                        }
                        disabled={personalWakeUpMinutes <= MIN_WAKE_MINUTES}
                        style={{
                          width: 40, height: 40, borderRadius: 20,
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: personalWakeUpMinutes <= MIN_WAKE_MINUTES ? colors.border : colors.primary,
                          opacity: personalWakeUpMinutes <= MIN_WAKE_MINUTES ? 0.4 : 1,
                        }}
                      >
                        <Ionicons name="remove" size={20} color={colors.primary} />
                      </TouchableOpacity>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 4, columnGap: 6 }}
                        style={{ flex: 1 }}
                      >
                        {Array.from(
                          { length: (MAX_WAKE_MINUTES - MIN_WAKE_MINUTES) / 5 + 1 },
                          (_, i) => MIN_WAKE_MINUTES + i * 5
                        ).map((mins) => {
                          const isActive = personalWakeUpMinutes === mins;
                          return (
                            <TouchableOpacity
                              key={`picker-${mins}`}
                              onPress={() => setPersonalWakeUpMinutes(mins)}
                              style={{
                                minWidth: 44,
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderRadius: 10,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: isActive ? colors.primary : 'transparent',
                                backgroundColor: isActive ? colors.primary + '20' : colors.surfaceVariant,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: isActive ? '800' : '500',
                                  color: isActive ? colors.primary : colors.textSecondary,
                                }}
                              >
                                {mins}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      <TouchableOpacity
                        onPress={() =>
                          setPersonalWakeUpMinutes((prev) =>
                            Math.min(MAX_WAKE_MINUTES, prev + 5)
                          )
                        }
                        disabled={personalWakeUpMinutes >= MAX_WAKE_MINUTES}
                        style={{
                          width: 40, height: 40, borderRadius: 20,
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: personalWakeUpMinutes >= MAX_WAKE_MINUTES ? colors.border : colors.primary,
                          opacity: personalWakeUpMinutes >= MAX_WAKE_MINUTES ? 0.4 : 1,
                        }}
                      >
                        <Ionicons name="add" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                      Allowed: {MIN_WAKE_MINUTES}–{MAX_WAKE_MINUTES} minutes before Suhoor ends
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 12, paddingVertical: 16, paddingHorizontal: 14, borderRadius: 12, marginTop: 8 },
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
            </View>
          )}
        </View>

        {/* Alarm Sound Section */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10, marginBottom: 12 }}>
            <Ionicons name="musical-notes" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 17, color: colors.text }}>{t('fastingTimes.alarmSound')}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('fastingTimes.defaultAlarmSub')}</Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              navigation?.navigate?.('ProfileTab', { tab: 'preferences', screen: 'ProfileTab', params: { tab: 'preferences' } }) ||
              navigation?.navigate?.('Profile', { tab: 'preferences' });
            }}
            style={{
              flexDirection: 'row', alignItems: 'center', columnGap: 12,
              paddingVertical: 14, paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: colors.primary,
              backgroundColor: colors.primary + '08',
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: colors.primary + '20',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>
                {userProfile?.preferences?.alarmSound ? `${userProfile.preferences.alarmSound.charAt(0).toUpperCase() + userProfile.preferences.alarmSound.slice(1)} Alarm` : t('fastingTimes.defaultAlarm')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {userProfile?.preferences?.alarmSound && userProfile?.preferences?.alarmSound !== 'default'
                  ? `Active sound set in profile (${userProfile.preferences.alarmSound})`
                  : t('fastingTimes.usingDefaultSound')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default FastingTimesScreen;