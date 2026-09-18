import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { db } from '../config/firebase';
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
import { Badge, Button, Card, Text } from './ui';
import { alpha, radius, spacing } from '../theme';

export const FastingPrompt = () => {
  const { currentUser, userProfile } = useAuth();
  const { colors } = useTheme();
  const { t, locale, formatDate } = useLanguage();
  const { scheduleDailySuhoorAlarm, cancelDailySuhoorAlarm } = useAlarmState();
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
        const statusRef = doc(db, 'daily_fasting_status', `${currentUser.uid}_${targetStr}`);
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

  const handleYes = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const statusRef = doc(db, 'daily_fasting_status', `${currentUser.uid}_${targetDate}`);
      await setDoc(statusRef, {
        userId: currentUser.uid,
        date: targetDate,
        wantsToFast: true,
        updatedAt: serverTimestamp(),
      });

      await AsyncStorage.setItem(`suhoor_intent_${targetDate}`, 'yes');

      // Schedule native Suhoor alarm at wake-up window start (45 min before Suhoor ends)
      // For now, use a default time - this should be enhanced to fetch actual Suhoor time
      const targetDateObj = new Date(targetDate + 'T00:00:00');
      let alarmTime = new Date(targetDateObj);
      alarmTime.setHours(4, 30, 0, 0); // Default 4:30 AM - should be replaced with actual Suhoor time - 45min
      
      if (scheduleDailySuhoorAlarm) {
        await scheduleDailySuhoorAlarm(alarmTime, 'Suhoor Wake-Up Alarm');
      }

      setStatus('confirmed_fasting');
      triggerToast(t('fasting.intentionSetToast'), 'success');
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
      const statusRef = doc(db, 'daily_fasting_status', `${currentUser.uid}_${targetDate}`);
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
            backgroundColor: '#FFFFFF',
            borderColor: '#E5E7EB',
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
                { borderColor: '#E5E7EB' },
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
              textStyle={{ color: colors.primary, fontWeight: '700' }}
            />
          </View>

          {isSpecial && defaultAnswer && (
            <Text
              variant="caption"
              style={[styles.footNote, { color: '#F59E0B' }]}
            >
              This defaults to Yes based on your settings, your alarm will be active during your wake-up window.
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
        <Card style={{ backgroundColor: colors.card, borderColor: colors.border }}>
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
        <Card style={{ backgroundColor: colors.card, borderColor: colors.border }}>
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
        // <Card style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
        <Card>
          <View style={styles.header}>
            <Image
              source={require('../assets/icon-nobg.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" style={{ color: '#065F46' }}>Fasting intention set</Text>
              <Text variant="caption" style={{ color: '#047857' }}>
                Your alarm is active. Check in during your wake-up window to dismiss it completely.
              </Text>
            </View>
          </View>
        </Card>
      )}

      {status === 'confirmed_not_fasting' && (
        <Card style={{ backgroundColor: colors.surfaceVariant, borderColor: colors.border }}>
          <View style={styles.header}>
            <Image
              source={require('../assets/icon-nobg.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" tone="secondary">Not fasting</Text>
              <Text variant="caption" tone="secondary">
                Your alarms won't ring and Your group won't be able to buzz you.
              </Text>
            </View>
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
  footNote: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default FastingPrompt;