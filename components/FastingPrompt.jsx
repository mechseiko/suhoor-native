import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Animated } from 'react-native';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/firestoreSchema';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
import { spacing, radius } from '../theme';
import { scheduleNotification, CHANNELS } from '../services/notifications';

export const FastingPrompt = () => {
  const { currentUser, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { t, locale, formatDate } = useLanguage();
  const { scheduleDailySuhoorAlarm, cancelDailySuhoorAlarm } = useAlarmState();
  
  // ADDED: fastingTimesLoading to prevent premature hiding
  const { getDayData, getWakeStart, checkWakeUpWindow, wakeMinutes, loading: fastingTimesLoading } = useFastingTimes();

  const [status, setStatus] = useState('idle');
  const [loading, setLoading] = useState(false);

  // ── Proactive-arm state ────────────────────────────────────────────────
  const [statusResolved, setStatusResolved] = useState(false);
  const autoArmedRef = useRef(null); // remembers which targetKey we already auto-armed

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');

  const triggerToast = (msg, type) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  // Tick every minute so visibility / banner recompute across boundaries.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // ── Target + visibility, derived at render ──────────────────────────────
  // getTargetFastingDate: 08:00–23:59 → tomorrow; 00:00–07:59 → today.
  const targetDateObj = getTargetFastingDate();
  const targetKey = targetDateObj ? targetDateObj.toLocaleDateString('en-CA') : null;
  const targetDateMidnight = targetKey ? new Date(`${targetKey}T00:00:00`) : null;
  const targetData = targetKey ? getDayData(targetKey) : null;

  const todayStr = new Date().toLocaleDateString('en-CA');
  const isTodayTarget = targetKey === todayStr;

  const defaultAnswer = targetDateMidnight
    ? getDefaultIntention(targetDateMidnight, userProfile)
    : false;

  const targetDisplay = targetDateObj
    ? formatDate(targetDateObj, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  // Visibility rule: hide once wakeStart(target) has passed.
  // wakeStart = suhoor(target) - wakeMinutes (user setting, default 45).
  const wakeStart = targetKey ? getWakeStart(targetKey, wakeMinutes) : null;
  
  // CHANGED: Show prompt while loading, or if wakeStart hasn't passed yet
  const isPromptVisible = fastingTimesLoading || !wakeStart 
    ? true 
    : nowTick < wakeStart.getTime();

  // ── Resolve status from Firestore / cache; re-run when targetKey flips ─
  useEffect(() => {
    if (!currentUser || !targetKey) {
      setStatus('idle');
      setStatusResolved(true); // nothing to resolve
      return;
    }
    let cancelled = false;
    setStatusResolved(false);

    const run = async () => {
      try {
        const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${targetKey}`);
        const statusSnap = await getDoc(statusRef);
        if (cancelled) return;

        if (statusSnap.exists()) {
          const wantsToFast = statusSnap.data().wantsToFast;
          await AsyncStorage.setItem(`suhoor_intent_${targetKey}`, wantsToFast ? 'yes' : 'no');
          if (cancelled) return;
          setStatus(wantsToFast ? 'confirmed_fasting' : 'confirmed_not_fasting');
          return;
        }

        const cached = await AsyncStorage.getItem(`suhoor_intent_${targetKey}`);
        if (cancelled) return;
        setStatus(
          cached === 'yes'
            ? 'confirmed_fasting'
            : cached === 'no'
            ? 'confirmed_not_fasting'
            : 'idle'
        );
      } catch (err) {
        console.error('Error resolving fasting status:', err);
        if (!cancelled) setStatus('idle');
      } finally {
        if (!cancelled) setStatusResolved(true);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [currentUser, targetKey]);

  // ── Proactive arm: if status is idle and the day defaults to Yes,
  //    schedule the alarm for wakeStart(target) in the background.
  //    Fires only once per targetKey; cleared on Reset so it can re-arm.
  useEffect(() => {
    if (!statusResolved) return;
    if (status !== 'idle') return;          // user already chose, or is confirming
    if (!defaultAnswer) return;             // normal day → no alarm, per doc
    if (!targetKey || !wakeStart) return;
    if (wakeStart.getTime() <= Date.now()) return; // too late, auto-record handles it
    if (autoArmedRef.current === targetKey) return;
    if (!scheduleDailySuhoorAlarm) return;

    autoArmedRef.current = targetKey;
    scheduleDailySuhoorAlarm(wakeStart, t('fasting.suhoorAlarmLabel')).catch((err) => {
      console.error('Auto-arm failed:', err);
      autoArmedRef.current = null; // allow retry on next render
    });
  }, [
    statusResolved,
    status,
    defaultAnswer,
    targetKey,
    wakeStart,
    scheduleDailySuhoorAlarm,
    t,
  ]);

  // The "You are fasting / You are not fasting" banner that used to sit above
  // this card has been removed, together with its Firestore listener and its
  // time-window calculation. The fasting prompt below is untouched: it is
  // driven entirely by `status`, `targetKey` and `wakeStart`, none of which
  // came from that listener.

  // ── Auto-record: inside wake window, write default if user never chose ─
  // Only writes the intent; the alarm was either armed explicitly (Yes),
  // proactively armed (default-Yes), or is not armed (No / normal day).
  useEffect(() => {
    if (!currentUser || !targetKey) return;
    if (status !== 'idle') return;
    if (!checkWakeUpWindow()) return;

    let cancelled = false;
    (async () => {
      try {
        const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${targetKey}`);
        const snap = await getDoc(statusRef);
        if (cancelled || snap.exists()) return;
        const cached = await AsyncStorage.getItem(`suhoor_intent_${targetKey}`);
        if (cancelled || cached) return;

        const dateMidnight = new Date(`${targetKey}T00:00:00`);
        const wantsToFast = getDefaultIntention(dateMidnight, userProfile);
        await setDoc(statusRef, {
          userId: currentUser.uid,
          date: targetKey,
          wantsToFast,
          isAutoDefault: true,
          updatedAt: serverTimestamp(),
        });
        await AsyncStorage.setItem(`suhoor_intent_${targetKey}`, wantsToFast ? 'yes' : 'no');
        if (cancelled) return;
        setStatus(wantsToFast ? 'confirmed_fasting' : 'confirmed_not_fasting');
      } catch (err) {
        console.error('Error auto-recording fasting intention:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, targetKey, status, checkWakeUpWindow, userProfile]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleYes = async () => {
    if (!currentUser || !targetKey) return;
    setLoading(true);
    try {
      const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${targetKey}`);
      await setDoc(statusRef, {
        userId: currentUser.uid,
        date: targetKey,
        wantsToFast: true,
        updatedAt: serverTimestamp(),
      });
      await AsyncStorage.setItem(`suhoor_intent_${targetKey}`, 'yes');

      // Schedule for the TARGET day's wakeStart — never today's suhoor.
      //
      // If the target day's window has already started, answering the prompt
      // used to leave the user with no alarm at all, silently. Roll forward to
      // the next day's wake start instead: saying "yes I intend to fast" should
      // always leave a real alarm behind.
      let alarmTime = getWakeStart(targetKey, wakeMinutes);
      if (alarmTime && alarmTime.getTime() <= Date.now()) {
        const nextDay = new Date(`${targetKey}T00:00:00`);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextAlarm = getWakeStart(nextDay.toLocaleDateString('en-CA'), wakeMinutes);
        if (nextAlarm && nextAlarm.getTime() > Date.now()) {
          alarmTime = nextAlarm;
        }
      }
      if (alarmTime && scheduleDailySuhoorAlarm && alarmTime.getTime() > Date.now()) {
        await scheduleDailySuhoorAlarm(alarmTime, t('fasting.suhoorAlarmLabel'));
      }

      // If setting intention for today, mark as checked-in to cancel notifications
      const todayStr = new Date().toLocaleDateString('en-CA');
      if (targetKey === todayStr) {
        await AsyncStorage.setItem(`suhoor_checked_in_${todayStr}`, 'true');
      }

      setStatus('confirmed_fasting');
      triggerToast(t('fasting.intentionSetToast'), 'success');

      await scheduleNotification({
        semanticId: `fasting_intention_${targetKey}`,
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
    if (!currentUser || !targetKey) return;
    setLoading(true);
    try {
      const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${targetKey}`);
      await setDoc(statusRef, {
        userId: currentUser.uid,
        date: targetKey,
        wantsToFast: false,
        updatedAt: serverTimestamp(),
      });
      await AsyncStorage.setItem(`suhoor_intent_${targetKey}`, 'no');
      if (cancelDailySuhoorAlarm) await cancelDailySuhoorAlarm();
      setStatus('confirmed_not_fasting');
      triggerToast(t('fasting.notFastingToast'), 'info');
    } catch (error) {
      console.error('Error saving fasting status (No):', error);
      triggerToast(t('fasting.saveErrorNo'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!currentUser || !targetKey) return;
    try {
      autoArmedRef.current = null; // allow proactive-arm to fire again
      await AsyncStorage.removeItem(`suhoor_intent_${targetKey}`);
      const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${targetKey}`);
      await deleteDoc(statusRef).catch(() => {});
      if (cancelDailySuhoorAlarm) await cancelDailySuhoorAlarm();
    } catch (err) {
      console.error('Error resetting fasting intention:', err);
    }
    setStatus('idle');
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (!isPromptVisible) return null;
  if (!targetKey || !targetDateMidnight) return null;

  // While the stored intention is still loading, show a skeleton instead of the
  // Yes / No question. Otherwise a user who already answered sees the question
  // flash first — and can tap it by accident — before the card flips to their
  // actual answer, which is exactly what happens on a slow connection.
  if (!statusResolved && status === 'idle') {
    return <FastingPromptSkeleton />;
  }

  // "Change my mind" stays available until 03:00 on the target day, and that
  // cut-off now applies to BOTH answers. Before, only the fasting card had the
  // 03:00 limit; the not-fasting card let you reset right up to the wake-up
  // window, so the two cards disagreed about the deadline. 03:00 is the point
  // where the night is effectively decided.
  const canChangeIntention =
    new Date() < new Date(targetDateMidnight.getTime() + 3 * 60 * 60 * 1000);

  const dateObj = targetDateMidnight;
  const isSpecial =
    isMondayOrThursday(dateObj) ||
    isWhiteDay(dateObj) ||
    isRamadan(dateObj) ||
    isFirstNineDhulHijjah(dateObj);
  const hijri = getHijriDate(dateObj);
  const formattedHijriMonth = hijriMonthName(dateObj, locale, hijri.month);

  return (
    <View style={{ gap: spacing.sm }}>
      <Toast
        message={toastMsg}
        type={toastType}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      {status === 'idle' && (
        <Card
          variant="default"
          style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
        >
          <View style={styles.header}>
            <Image source={require('../assets/icon-nobg.png')} style={styles.logoIcon} resizeMode="contain" />
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
                <Badge label={t('fasting.whiteDay', { day: hijri.day })} tone="secondary" bordered />
              )}
              {isFirstNineDhulHijjah(dateObj) && !isRamadan(dateObj) && (
                <Badge label={t('fasting.dhulHijjahDay', { day: hijri.day })} tone="accent" bordered />
              )}
              {isRamadan(dateObj) && (
                <Badge label={t('fasting.ramadanDay', { day: hijri.day })} tone="secondary" bordered />
              )}
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              title={t('fasting.no')}
              onPress={() => setStatus('confirming_no')}
              variant="outline"
              style={[styles.flexButton, { borderColor: colors.border }]}
              textStyle={{ color: colors.textSecondary }}
            />
            <Button
              title={t('fasting.yes')}
              onPress={() => setStatus('confirming_yes')}
              variant="secondary"
              style={[styles.flexButton, { backgroundColor: colors.secondary }]}
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
            <Text variant="caption" tone="secondary" style={styles.footNote}>
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
            <Image source={require('../assets/icon-nobg.png')} style={styles.logoIcon} resizeMode="contain" />
            <View style={styles.headerText}>
              <Text variant="h3">{t('fasting.confirmTitle')}</Text>
              <Text variant="caption" tone="secondary">{t('fasting.confirmSub')}</Text>
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
            <Image source={require('../assets/icon-nobg.png')} style={styles.logoIcon} resizeMode="contain" />
            <View style={styles.headerText}>
              <Text variant="h3">{t('fasting.skipTitle')}</Text>
              <Text variant="caption" tone="secondary">{t('fasting.skipSub')}</Text>
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
            <Image source={require('../assets/icon-nobg.png')} style={styles.logoIcon} resizeMode="contain" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" style={{ color: isDark ? '#34D399' : '#065F46' }}>
                {t('fasting.intentionSet')}
              </Text>
              <Text variant="caption" style={{ color: isDark ? '#A7F3D0' : '#047857' }}>
                {t('fasting.alarmActiveNotice')}
              </Text>
            </View>
            {/* Reset disappears at 03:00 on the target day (canChangeIntention) */}
            {canChangeIntention && (
              <TouchableOpacity
                onPress={handleReset}
                style={styles.resetButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('fasting.changeIntention')}
              >
                <Ionicons name="refresh" size={18} color={isDark ? '#34D399' : '#059669'} />
                <Text style={{ color: isDark ? '#34D399' : '#059669', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
                  Reset
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>
      )}

      {status === 'confirmed_not_fasting' && (
        <Card style={{ backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderWidth: 1 }}>
          <View style={styles.header}>
            <Image source={require('../assets/icon-nobg.png')} style={styles.logoIcon} resizeMode="contain" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" tone="secondary">{t('fasting.notFasting')}</Text>
              <Text variant="caption" tone="secondary">{t('fasting.notFastingSub')}</Text>
            </View>
            {/* Same 03:00 cut-off as the fasting card — one deadline, both answers */}
            {canChangeIntention && (
              <TouchableOpacity
                onPress={handleReset}
                style={styles.resetButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('fasting.changeIntention')}
              >
                <Ionicons name="refresh" size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
                  Reset
                </Text>
              </TouchableOpacity>
            )}
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
  logoIcon: { width: 30, height: 30 },
  headerText: { flex: 1, columnGap: spacing.xxs, rowGap: spacing.xxs },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
    marginBottom: spacing.base,
  },
  buttonRow: { flexDirection: 'row', columnGap: spacing.md, rowGap: spacing.md },
  flexButton: { flex: 1 },
  resetButton: { flexDirection: 'row', alignItems: 'center', padding: spacing.xs },
  footNote: { textAlign: 'center', marginTop: spacing.md },
});

/**
 * Skeleton shown while the stored intention is loading.
 *
 * Same shape as the real prompt card, with the same shimmer as the group member
 * skeletons: one Animated value translating a band, transform only, native
 * driver, static layout props. (Mixing a native-driven opacity with layout props
 * is what crashed the AppTour.)
 */
const FastingPromptSkeleton = () => {
  const shimmer = useRef(new Animated.Value(0)).current;
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 420],
  });

  const base = colors.surfaceVariant;
  const band = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)';

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.xl,
        padding: spacing.base,
        overflow: 'hidden',
        rowGap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: spacing.md }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: base }} />
        <View style={{ flex: 1, rowGap: 6 }}>
          <View style={{ width: '55%', height: 14, borderRadius: 7, backgroundColor: base }} />
          <View style={{ width: '80%', height: 11, borderRadius: 6, backgroundColor: base }} />
        </View>
      </View>
      <View style={{ width: '65%', height: 11, borderRadius: 6, backgroundColor: base, marginTop: spacing.xs }} />
      <View style={{ flexDirection: 'row', columnGap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ flex: 1, height: 44, borderRadius: radius.lg, backgroundColor: base }} />
        <View style={{ flex: 1, height: 44, borderRadius: radius.lg, backgroundColor: base }} />
      </View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 120,
          backgroundColor: band,
          transform: [{ translateX }],
        }}
      />
    </View>
  );
};

export default FastingPrompt;
