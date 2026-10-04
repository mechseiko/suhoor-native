import React, { useState, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { useFastingTimes } from '../../hooks/useFastingTimes';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { hijriMonthName } from '../../config/languages';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getHijriDate } from '../../utils/fastingUtils';

export const FastingTimesScreen = () => {
  const { colors } = useTheme();
  const { t, locale, formatDate } = useLanguage();
  const { todayData, loading, error, location } = useFastingTimes();
  const [refreshing, setRefreshing] = useState(false);

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
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('common.retry')}</Text>
          </TouchableOpacity>
          <Text style={{ marginTop: 12, fontSize: 11, color: colors.textSecondary, textAlign: 'center' }}>
            {t('fastingTimes.errorHint')}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const suhoorTime = todayData?.time?.sahur || '--:--';
  const iftarTime = todayData?.time?.iftar || '--:--';

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

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};


export default FastingTimesScreen;
