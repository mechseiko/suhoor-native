import React, { useCallback, useEffect, useState } from 'react';
import { AppState, NativeModules, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Button, Card, Text } from './ui';
import { radius, spacing } from '../theme';

/**
 * One card that explains why an alarm may not ring, instead of three stacked
 * nag cards. Each issue is a row with a single button that opens the exact
 * Android settings screen that fixes it.
 *
 * Checks (all safe no-ops when the native method is missing, e.g. an older
 * APK running new JS):
 *  - battery optimization ON  -> the process can be paused, overlay may not appear
 *  - exact alarms OFF         -> scheduleAlarm() is refused, no alarm at all
 *  - full-screen intent OFF   -> Android 14+, alarm degrades to a heads-up
 */
const SNOOZE_KEY = 'suhoor_alarm_checks_snoozed_until';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

const ISSUE_ICONS = {
  battery: 'battery-half-outline',
  exact: 'alarm-outline',
  fullscreen: 'expand-outline',
};

export const AlarmReliabilityCard = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [issues, setIssues] = useState([]);
  const [snoozed, setSnoozed] = useState(false);

  const check = useCallback(async () => {
    if (Platform.OS !== 'android' || !NativeModules?.AlarmBridge) return;

    try {
      const snoozeUntil = await AsyncStorage.getItem(SNOOZE_KEY);
      if (snoozeUntil && Number(snoozeUntil) > Date.now()) {
        setSnoozed(true);
        return;
      }
    } catch (e) {
      // Ignore storage errors; showing the card is the safer default.
    }

    const bridge = NativeModules.AlarmBridge;
    const found = [];

    try {
      if (bridge.isBatteryOptimizationDisabled) {
        const disabled = await bridge.isBatteryOptimizationDisabled();
        if (disabled !== true) found.push('battery');
      }
    } catch (e) {
      // Treat an unreadable status as "unknown" rather than nagging.
    }

    try {
      if (bridge.canScheduleExactAlarms) {
        const exact = await bridge.canScheduleExactAlarms();
        if (exact === false) found.push('exact');
      }
    } catch (e) {}

    try {
      if (bridge.canUseFullScreenIntent) {
        const fsi = await bridge.canUseFullScreenIntent();
        if (fsi === false) found.push('fullscreen');
      }
    } catch (e) {}

    setIssues(found);
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub?.remove();
  }, [check]);

  const handleFix = async (issue) => {
    const bridge = NativeModules?.AlarmBridge;
    if (!bridge) return;
    try {
      if (issue === 'battery' && bridge.openBatteryOptimizationSettings) {
        await bridge.openBatteryOptimizationSettings();
      } else if (issue === 'exact' && bridge.openExactAlarmSettings) {
        await bridge.openExactAlarmSettings();
      } else if (issue === 'fullscreen' && bridge.openFullScreenIntentSettings) {
        await bridge.openFullScreenIntentSettings();
      }
    } catch (e) {
      console.warn('Could not open alarm settings:', e);
    }
  };

  const handleLater = async () => {
    setIssues([]);
    setSnoozed(true);
    try {
      await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch (e) {}
  };

  if (Platform.OS !== 'android' || snoozed || issues.length === 0) return null;

  return (
    <Card style={[styles.card, { borderColor: colors.warning, borderWidth: 1.5 }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
          <Ionicons name="alarm-outline" size={20} color={colors.error || '#EF4444'} />
        </View>
        <View style={styles.headerText}>
          <Text variant="h3" style={{ color: colors.error || '#EF4444' }}>
            {t('home.deviceChecksTitle')}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('home.deviceChecksDesc')}
          </Text>
        </View>
      </View>

      {issues.map((issue) => (
        <View key={issue} style={[styles.row, { borderTopColor: colors.border }]}>
          <Ionicons
            name={ISSUE_ICONS[issue]}
            size={18}
            color={colors.textSecondary}
            style={styles.rowIcon}
          />
          <View style={styles.rowText}>
            <Text variant="body" style={{ fontSize: 13, fontWeight: '600' }}>
              {t(`home.deviceCheck_${issue}Title`)}
            </Text>
            <Text variant="caption" tone="secondary">
              {t(`home.deviceCheck_${issue}Desc`)}
            </Text>
          </View>
          <Button
            title={t('home.deviceChecksFix')}
            onPress={() => handleFix(issue)}
            variant="secondary"
            size="sm"
            fullWidth={false}
            style={styles.fixButton}
          />
        </View>
      ))}

      <TouchableOpacity onPress={handleLater} style={styles.laterButton} accessibilityRole="button">
        <Text variant="caption" tone="secondary">
          {t('home.deviceChecksLater')}
        </Text>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    columnGap: spacing.xxs,
    rowGap: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  rowIcon: {
    marginTop: 2,
  },
  rowText: {
    flex: 1,
    columnGap: spacing.xxs,
    rowGap: spacing.xxs,
  },
  fixButton: {
    paddingHorizontal: 14,
    borderRadius: radius.xl,
  },
  laterButton: {
    alignSelf: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xxs,
  },
});

export default AlarmReliabilityCard;
