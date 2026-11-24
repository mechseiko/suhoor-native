import React, { useCallback, useEffect, useState } from 'react'
import {
  AppState,
  Modal,
  NativeModules,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useAlarmState } from '../context/AlarmContext'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { Button, Text } from './ui'
import { radius, spacing } from '../theme'

/**
 * Blocks the app while an alarm is armed but Android will not let it take over
 * the lock screen.
 *
 * Why this is a gate and not another card: `USE_FULL_SCREEN_INTENT` is granted
 * automatically only to calling and alarm apps. For everyone else Google Play
 * revokes it, and on Android 14+ the notification silently degrades to a
 * heads-up that does not appear at all while the phone is locked. The alarm
 * then rings with no screen to dismiss it — the exact failure users report as
 * "my alarm did not show". A dismissible card on the Home tab was easy to miss;
 * an armed alarm with no way to appear is worth one interruption.
 *
 * Deliberate limits:
 *  - only shown once an alarm is actually armed, so a fresh install never sees it;
 *  - never shown while an alarm is ringing (the PIN overlay must win);
 *  - "Not now" hides it for the rest of the app session, not forever, so the
 *    next launch asks again;
 *  - re-checked on every resume, so granting the permission in Settings makes
 *    it disappear immediately without a restart;
 *  - if the check itself fails (older APK without the method, vendor build),
 *    it stays quiet instead of nagging about something it cannot read.
 */
export const AlarmPermissionGate = () => {
  const { scheduledAlarmTime, isAlarmActive } = useAlarmState()
  const { t } = useLanguage()
  const { colors } = useTheme()

  const [canUseFsi, setCanUseFsi] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  const check = useCallback(async () => {
    if (
      Platform.OS !== 'android' ||
      !NativeModules?.AlarmBridge?.canUseFullScreenIntent
    ) {
      setCanUseFsi(true)
      return
    }
    try {
      const allowed = await NativeModules.AlarmBridge.canUseFullScreenIntent()
      setCanUseFsi(allowed === true)
    } catch (error) {
      console.warn('Could not read the full-screen intent permission:', error)
      setCanUseFsi(true) // unknown: never nag on a guess
    }
  }, [])

  useEffect(() => {
    check()
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') check()
    })
    return () => sub?.remove()
  }, [check])

  // Arming an alarm is the moment the permission starts to matter.
  useEffect(() => {
    if (scheduledAlarmTime) check()
  }, [scheduledAlarmTime, check])

  const openSettings = async () => {
    try {
      await NativeModules?.AlarmBridge?.openFullScreenIntentSettings?.()
    } catch (error) {
      console.warn('Could not open full-screen intent settings:', error)
    }
  }

  const visible =
    Platform.OS === 'android' &&
    canUseFsi === false &&
    Boolean(scheduledAlarmTime) &&
    !isAlarmActive &&
    !dismissed

  if (!visible) return null

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setDismissed(true)}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
            ]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={26}
              color={colors.error || '#EF4444'}
            />
          </View>

          <Text variant="h3" style={styles.title}>
            {t(
              'alarm.fsiGateTitle',
              'Your alarm cannot appear over the lock screen'
            )}
          </Text>

          <Text variant="body" tone="secondary" style={styles.body}>
            {t(
              'alarm.fsiGateBody',
              'Android 14 and newer only allow alarm apps to show a screen on ' +
                'top of the lock screen. Allow this in the next screen, or your ' +
                'Suhoor alarm will ring without any screen to dismiss it.'
            )}
          </Text>

          <Button
            title={t('alarm.fsiGateOpen', 'OPEN SETTINGS')}
            onPress={openSettings}
            variant="primary"
            style={styles.action}
          />

          <TouchableOpacity
            onPress={() => setDismissed(true)}
            style={styles.later}
            accessibilityRole="button"
          >
            <Text variant="caption" tone="secondary">
              {t('alarm.fsiGateLater', 'Not now')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 6, 24, 0.72)',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  action: {
    marginBottom: spacing.sm,
  },
  later: {
    paddingVertical: spacing.sm,
  },
})

export default AlarmPermissionGate
