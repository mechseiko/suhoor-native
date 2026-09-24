import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/firestoreSchema';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { hijriMonthName } from '../config/languages';
import {
  getHijriDate,
  isMondayOrThursday,
  isWhiteDay,
  isRamadan,
  isFirstNineDhulHijjah,
  getTargetFastingDate,
  getDefaultIntention,
} from '../utils/fastingUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from './Toast';
import { useAlarmState } from '../context/AlarmContext';
import { useFastingTimes } from '../hooks/useFastingTimes';
import { Badge, Button, Card, Text } from './ui';
import { alpha, radius, spacing } from '../theme';
import { scheduleNotification, CHANNELS } from '../services/notifications';

export const FastingPrompt = () => {
  const { currentUser, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { t, locale, formatDate } = useLanguage();
  const { scheduleDailySuhoorAlarm, cancelDailySuhoorAlarm } = useAlarmState();
  const { todayData, checkWakeUpWindow } = useFastingTimes();
  const [status, setStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [targetDisplay, setTargetDisplay] = useState('');
  const [defaultAnswer, setDefaultAnswer] = useState(false);
  const [isTodayTarget, setIsTodayTarget] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');

  const triggerToast = (msg, type) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  useEffect(() => {
    const determineTarget = async () => {
      if (!currentUser) return;
      const target = getTargetFastingDate();

      if (!target) {
        setStatus('hidden');
        return;
      }

      // Determine if the target is today (midnight–8am) or tomorrow (8am+)
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      const targetStr = target.toLocaleDateString('en-CA');
      setIsTodayTarget(targetStr === todayStr);

      // Check cache first
      try {
        const cachedAnswer = await AsyncStorage.getItem(`suhoor_intent_${targetStr}`);

        // Check Firestore database (server of truth)
        const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${targetStr}`);
        const statusSnap = await getDoc(statusRef);
        if (statusSnap.exists()) {
          const wantsToFast = statusSnap.data().wantsToFast;
          await AsyncStorage.setItem(`suhoor_intent_${targetStr}`, wantsToFast ? 'yes' : 'no');
          setStatus(wantsToFast ? 'confirmed_fasting' : 'confirmed_not_fasting');
          setTargetDate(targetStr);
          setTargetDisplay(
            formatDate(target, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          );
          return;
        } else if (cachedAnswer) {
          setStatus(cachedAnswer === 'yes' ? 'confirmed_fasting' : 'confirmed_not_fasting');
          setTargetDate(targetStr);
          setTargetDisplay(
            formatDate(target, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          );
          return;
        }
      } catch (err) {
        console.error('Error checking fasting cache/db:', err);
      }

      setTargetDate(targetStr);
      setTargetDisplay(
        formatDate(target, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      );
      setDefaultAnswer(getDefaultIntention(target, userProfile));
    };

    determineTarget();
  }, [currentUser, userProfile, formatDate]);

  // Auto-record the intention at the start of the wake-up window when the
  // prompt was never answered — special days follow the user's fasting
  // defaults, ordinary days default to not fasting.
  useEffect(() => {
    if (!currentUser) return;
    const wakeMinutes =
      userProfile?.preferences?.wakeUpMinutesBeforeSuhoor || 45;
    if (!checkWakeUpWindow || !checkWakeUpWindow(wakeMinutes)) return;

    const target = getTargetFastingDate();
    if (!target) return;
    const targetStr = target.toLocaleDateString('en-CA');

    (async () => {
      try {
        const statusRef = doc(
          db,
          COLLECTIONS.dailyFastingStatus,
          `${currentUser.uid}_${targetStr}`
        );
        const statusSnap = await getDoc(statusRef);
        if (statusSnap.exists()) return;
        const cachedAnswer = await AsyncStorage.getItem(
          `suhoor_intent_${targetStr}`
        );
        if (cachedAnswer) return;

        const wantsToFast = getDefaultIntention(target, userProfile);
        await setDoc(statusRef, {
          userId: currentUser.uid,
          date: targetStr,
          wantsToFast,
          updatedAt: serverTimestamp(),
        });
        await AsyncStorage.setItem(
          `suhoor_intent_${targetStr}`,
          wantsToFast ? 'yes' : 'no'
        );

        const [sH, sM] = (todayData?.time?.sahur || '').split(':').map(Number);
        if (wantsToFast) {
          if (!isNaN(sH) && !isNaN(sM) && scheduleDailySuhoorAlarm) {
            const alarmTime = new Date();
            alarmTime.setHours(sH, sM, 0, 0);
            alarmTime.setMinutes(alarmTime.getMinutes() - wakeMinutes);
            if (alarmTime.getTime() > Date.now()) {
              await scheduleDailySuhoorAlarm(alarmTime, t('fasting.suhoorAlarmLabel'));
            }
          }
        } else if (cancelDailySuhoorAlarm) {
          await cancelDailySuhoorAlarm();
        }
      } catch (err) {
        console.error('Error auto-recording fasting intention:', err);
      }
    })();
  }, [
    currentUser,
    userProfile,
    todayData,
    checkWakeUpWindow,
    scheduleDailySuhoorAlarm,
    cancelDailySuhoorAlarm,
  ]);

  const handleYes = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${targetDate}`);
      await setDoc(statusRef, {
        userId: currentUser.uid,
        date: targetDate,
        wantsToFast: true,
        updatedAt: serverTimestamp(),
      });

      await AsyncStorage.setItem(`suhoor_intent_${targetDate}`, 'yes');

      // Wake-up alarm = suhoor end minus the user's wake-up window length.
      // Suhoor's time of day drifts by ~1 minute a day, so today's value is
      // the closest source when the prompt targets tomorrow.
      const wakeMinutes =
        userProfile?.preferences?.wakeUpMinutesBeforeSuhoor || 45;
      const [sH, sM] = (todayData?.time?.sahur || '').split(':').map(Number);
      const alarmTime = new Date(`${targetDate}T00:00:00`);
      if (!isNaN(sH) && !isNaN(sM)) {
        alarmTime.setHours(sH, sM, 0, 0);
        alarmTime.setMinutes(alarmTime.getMinutes() - wakeMinutes);
      } else {
        alarmTime.setHours(4, 30, 0, 0);
      }

      if (scheduleDailySuhoorAlarm && alarmTime.getTime() > Date.now()) {
        await scheduleDailySuhoorAlarm(alarmTime, t('fasting.suhoorAlarmLabel'));
      }

      setStatus('confirmed_fasting');
      triggerToast(t('fasting.intentionSetToast'), 'success');
      
      // Schedule fasting intention notification
      await scheduleNotification({
        semanticId: `fasting_intention_${targetDate}`,
        date: new Date(),
        title: t('fasting.intentionSet'),
        message: t('fasting.alarmActiveNotice'),
        channel: CHANNELS.fastingPrompt,
      });
    } catch (error) {
      console.error('Error saving fasting status (Yes):', error);
      triggerToast(t('fasting.saveError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNo = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${targetDate}`);
      await setDoc(statusRef, {
        userId: currentUser.uid,
        date: targetDate,
        wantsToFast: false,
        updatedAt: serverTimestamp(),
      });

      await AsyncStorage.setItem(`suhoor_intent_${targetDate}`, 'no');

      // Cancel scheduled alarm if any
      if (cancelDailySuhoorAlarm) {
        await cancelDailySuhoorAlarm();
      }

      setStatus('confirmed_not_fasting');
      triggerToast(t('fasting.notFastingToast'), 'info');
    } catch (error) {
      console.error('Error saving fasting status (No):', error);
      triggerToast(t('fasting.saveErrorNo'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDefaultAnswer(
      getDefaultIntention(new Date(`${targetDate}T00:00:00`), userProfile)
    );
    setStatus('idle');
  };

  // Hide entirely during the wake-up window — not the time for tomorrow's fasting prompt
  if (todayData?.isWakeUpWindow) return null;
  if (status === 'hidden' || !targetDate) return null;

  const dateObj = new Date(targetDate + 'T00:00:00');
  const isSpecial =
    isMondayOrThursday(dateObj) ||
    isWhiteDay(dateObj) ||
    isRamadan(dateObj) ||
    isFirstNineDhulHijjah(dateObj);
  const hijri = getHijriDate(dateObj);

  // Localized Hijri month name — the list and the Intl tag both come from
  // config/languages.js, so no month name is spelled out in this file.
  const formattedHijriMonth = hijriMonthName(dateObj, locale, hijri.month);

  return (
    <View>
      <Toast
        message={toastMsg}
        type={toastType}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      {status === 'idle' && (
        <Card
          variant="default"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          <View style={styles.header}>
            <Image
              source={require('../assets/icon-nobg.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <View style={styles.headerText}>
              <Text variant="h3" style={{ color: colors.text }}>
                {isTodayTarget ? t('fasting.promptToday') : t('fasting.prompt')}
              </Text>
              <Text variant="caption" tone="secondary">
                {t('fasting.subtitle', { date: targetDisplay })}
              </Text>
              <Text variant="caption" tone="secondary" style={{ opacity: 0.75 }}>
                {t('fasting.hijriDate', {
                  day: hijri.day,
                  month: formattedHijriMonth,
                  year: hijri.year,
                })}
              </Text>
            </View>
          </View>

          {isSpecial && (
            <View style={styles.badgeRow}>
              {isMondayOrThursday(dateObj) && !isRamadan(dateObj) && (
                <Badge label={t('fasting.sunnahFast')} tone="accent" bordered />
              )}
              {isWhiteDay(dateObj) && !isRamadan(dateObj) && (
                <Badge
                  label={t('fasting.whiteDay', { day: hijri.day })}
                  tone="secondary"
                  bordered
                />
              )}
              {isFirstNineDhulHijjah(dateObj) && !isRamadan(dateObj) && (
                <Badge
                  label={t('fasting.dhulHijjahDay', { day: hijri.day })}
                  tone="accent"
                  bordered
                />
              )}
              {isRamadan(dateObj) && (
                <Badge
                  label={t('fasting.ramadanDay', { day: hijri.day })}
                  tone="secondary"
                  bordered
                />
              )}
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              title={t('fasting.no')}
              onPress={() => setStatus('confirming_no')}
              variant="outline"
              style={[
                styles.flexButton,
                { borderColor: colors.border },
              ]}
              textStyle={{ color: colors.textSecondary }}
            />
            <Button
              title={t('fasting.yes')}
              onPress={() => setStatus('confirming_yes')}
              variant="secondary"
              style={[
                styles.flexButton,
                { backgroundColor: colors.secondary },
              ]}
              textStyle={{ color: '#1D1145', fontWeight: '700' }}
            />
          </View>

          {isSpecial && defaultAnswer && (
            <Text
              variant="caption"
              style={[styles.footNote, { color: isDark ? '#FBBF24' : '#D97706' }]}
            >
              {t('fasting.defaultYesNote')}
            </Text>
          )}

          {isSpecial && !defaultAnswer && (
            <Text
              variant="caption"
              tone="secondary"
              style={styles.footNote}
            >
              {t('fasting.defaultsTo', {
                answer: defaultAnswer ? t('fasting.yes') : t('fasting.no'),
              })}
            </Text>
          )}
        </Card>
      )}

      {status === 'confirming_yes' && (
        <Card style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
          <View style={styles.header}>
            <Image
              source={require('../assets/icon-nobg.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <View style={styles.headerText}>
              <Text variant="h3">{t('fasting.confirmTitle')}</Text>
              <Text variant="caption" tone="secondary">
                {t('fasting.confirmSub')}
              </Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Button
              title={t('common.back')}
              onPress={() => setStatus('idle')}
              variant="outline"
              style={styles.flexButton}
            />
            <Button
              title={t('alarm.confirm')}
              onPress={handleYes}
              loading={loading}
              icon="checkmark"
              style={styles.flexButton}
            />
          </View>
        </Card>
      )}

      {status === 'confirming_no' && (
        <Card style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
          <View style={styles.header}>
            <Image
              source={require('../assets/icon-nobg.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <View style={styles.headerText}>
              <Text variant="h3">{t('fasting.skipTitle')}</Text>
              <Text variant="caption" tone="secondary">
                {t('fasting.skipSub')}
              </Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Button
              title={t('common.back')}
              onPress={() => setStatus('idle')}
              variant="outline"
              style={styles.flexButton}
            />
            <Button
              title={t('fasting.skipButton')}
              onPress={handleNo}
              loading={loading}
              variant="danger"
              style={styles.flexButton}
            />
          </View>
        </Card>
      )}

      {status === 'confirmed_fasting' && (
        <Card
          style={{
            backgroundColor: colors.surface,
            borderColor: isDark ? 'rgba(52, 211, 153, 0.3)' : '#BBF7D0',
            borderWidth: 1,
          }}
        >
          <View style={styles.header}>
            <Image
              source={require('../assets/icon-nobg.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" style={{ color: isDark ? '#34D399' : '#065F46' }}>
                {t('fasting.intentionSet')}
              </Text>
              <Text variant="caption" style={{ color: isDark ? '#A7F3D0' : '#047857' }}>
                {t('fasting.alarmActiveNotice')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleReset}
              style={styles.resetButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('fasting.changeIntention')}
            >
              <Ionicons
                name="refresh"
                size={20}
                color={isDark ? '#34D399' : '#059669'}
              />
              <Text style={{ color: isDark ? '#34D399' : '#059669', fontSize: 12, marginLeft: 4 }}>
                Reset
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {status === 'confirmed_not_fasting' && (
        <Card style={{ backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderWidth: 1 }}>
          <View style={styles.header}>
            <Image
              source={require('../assets/icon-nobg.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" tone="secondary">
                {t('fasting.notFasting')}
              </Text>
              <Text variant="caption" tone="secondary">
                {t('fasting.notFastingSub')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleReset}
              style={styles.resetButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('fasting.changeIntention')}
            >
              <Ionicons name="refresh" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: spacing.md,
    rowGap: spacing.md,
    marginBottom: spacing.base,
  },
  glyph: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    width: 30,
    height: 30,
  },
  headerText: {
    flex: 1,
    columnGap: spacing.xxs,
    rowGap: spacing.xxs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
    marginBottom: spacing.base,
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  flexButton: {
    flex: 1,
  },
  resetButton: {
    padding: spacing.xs,
  },
  footNote: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default FastingPrompt;