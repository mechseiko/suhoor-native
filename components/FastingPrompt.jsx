import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
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
import { radius, spacing } from '../theme';
import { scheduleNotification, CHANNELS } from '../services/notifications';

export const FastingPrompt = () => {
  const { currentUser, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { t, locale, formatDate } = useLanguage();
  const { scheduleDailySuhoorAlarm, cancelDailySuhoorAlarm } = useAlarmState();
  const { getDayData, getWakeStart, checkWakeUpWindow, wakeMinutes } = useFastingTimes();

  const [status, setStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [currentDayFastingStatus, setCurrentDayFastingStatus] = useState(null);

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
  const isPromptVisible = !!(wakeStart && nowTick < wakeStart.getTime());

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

  // ── Current day fasting status (for the top banner) ────────────────────
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const statusRef = doc(db, COLLECTIONS.dailyFastingStatus, `${currentUser.uid}_${todayStr}`);
        const snap = await getDoc(statusRef);
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          if (d.checkedIn === true) setCurrentDayFastingStatus('fasting');
          else if (d.wantsToFast === true) setCurrentDayFastingStatus('pending');
          else if (d.wantsToFast === false) setCurrentDayFastingStatus('not_fasting');
          else setCurrentDayFastingStatus(null);
        } else {
          setCurrentDayFastingStatus(null);
        }
      } catch (err) {
        console.error('Error fetching current day status:', err);
      }
    };
    fetchStatus();
    return () => { cancelled = true; };
  }, [currentUser, todayStr]);

  // ── Banner time-window (today's suhoor/iftar) ──────────────────────────
  const [bannerMode, setBannerMode] = useState('hidden');
  useEffect(() => {
    const computeMode = () => {
      const day = getDayData(todayStr);
      if (!day?.time) return;
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const parseMins = (s) => {
        if (!s) return null;
        const [h, m] = s.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
      };
      const suhoorMins = parseMins(day.time.sahur);
      const iftarMins = parseMins(day.time.iftar || day.time.maghrib);
      const endOfBannerMins = 20 * 60;
      if (suhoorMins === null) return;
      if (nowMinutes < suhoorMins) setBannerMode('hidden');
      else if (iftarMins !== null && nowMinutes >= iftarMins && nowMinutes < endOfBannerMins) setBannerMode('iftar');
      else if (nowMinutes >= endOfBannerMins) setBannerMode('hidden');
      else setBannerMode('fasting_status');
    };
    computeMode();
    const id = setInterval(computeMode, 60000);
    return () => clearInterval(id);
  }, [getDayData, todayStr]);

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
      const alarmTime = getWakeStart(targetKey, wakeMinutes);
      if (alarmTime && scheduleDailySuhoorAlarm && alarmTime.getTime() > Date.now()) {
        await scheduleDailySuhoorAlarm(alarmTime, t('fasting.suhoorAlarmLabel'));
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

      {bannerMode === 'iftar' && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.10)',
              borderColor: isDark ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.3)',
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="h3" style={{ fontSize: 13, color: isDark ? '#FCD34D' : '#B45309' }}>
              {t('fasting.iftarTime')}
            </Text>
          </View>
        </View>
      )}

      {bannerMode === 'fasting_status' && currentDayFastingStatus && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor:
                currentDayFastingStatus === 'fasting'
                  ? isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)'
                  : currentDayFastingStatus === 'pending'
                  ? isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(251, 191, 36, 0.08)'
                  : isDark ? 'rgba(107, 114, 128, 0.15)' : 'rgba(107, 114, 128, 0.08)',
              borderColor:
                currentDayFastingStatus === 'fasting'
                  ? isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'
                  : currentDayFastingStatus === 'pending'
                  ? isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.2)'
                  : isDark ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.2)',
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              variant="h3"
              style={{
                fontSize: 13,
                color:
                  currentDayFastingStatus === 'fasting'
                    ? colors.success || '#10B981'
                    : currentDayFastingStatus === 'pending'
                    ? isDark ? '#FCD34D' : '#B45309'
                    : colors.textSecondary,
              }}
            >
              {currentDayFastingStatus === 'fasting'
                ? t('fasting.youAreFasting')
                : currentDayFastingStatus === 'pending'
                ? t('fasting.intentPending')
                : t('fasting.youAreNotFasting')}
            </Text>
            {currentDayFastingStatus === 'fasting' && (
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? '#A7F3D0' : '#047857',
                  marginTop: 1,
                }}
              >
                {t('fasting.mayAllahAccept')}
              </Text>
            )}
          </View>
        </View>
      )}

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
          </View>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
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

export default FastingPrompt;