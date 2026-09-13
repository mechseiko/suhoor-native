import React, { useState, useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Audio } from 'expo-av'
import { useAlarm } from '../hooks/useAlarm'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { useAlarmState } from '../context/AlarmContext'
import { useSocket } from '../context/SocketContext'
import {
  WAKE_VERIFY_PATTERN,
  matchesWakeVerifyDate,
} from '../utils/fastingUtils'
import { brand, neutral } from '../theme'
import { Button, Text } from './ui'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export const AlarmOverlay = () => {
  const { currentUser, userProfile } = useAuth()
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { logWakeUpTime, cancelAlarm } = useAlarm()
  const { isAlarmActive, alarmData, dismissAlarm } = useAlarmState()
  const { emitWakeUp } = useSocket()

  // Status: 'ringing', 'dismiss_challenge', 'success'
  const [status, setStatus] = useState('ringing')
  const [pinDigits, setPinDigits] = useState(['', '', '', ''])
  const [pinError, setPinError] = useState('')
  const pinRefs = [useRef(), useRef(), useRef(), useRef()]
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  const pulseAnim = useRef(new Animated.Value(1)).current
  const ringAnim1 = useRef(new Animated.Value(0.8)).current
  const ringAnim2 = useRef(new Animated.Value(0.6)).current

  const visible = isAlarmActive
  const isBuzz = alarmData?.type === 'buzz'
  const groupId = alarmData?.groupId

  // Clock tick
  useEffect(() => {
    if (visible) {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000)
      return () => clearInterval(timer)
    }
  }, [visible])

  // Reset state on appear
  useEffect(() => {
    if (visible) {
      setStatus('ringing')
      setPinDigits(['', '', '', ''])
      setPinError('')
    }
  }, [visible])

  const soundRef = useRef(null)
  const soundAllowed = userProfile?.preferences?.soundEnabled ?? true
  const customAudioUrl = userProfile?.preferences?.customAlarmAudioUrl
  const alarmAudioMode = userProfile?.preferences?.alarmAudioMode || 'default'

  // Vibration and audio playback
  useEffect(() => {
    if (visible && status === 'ringing') {
      if (soundAllowed) {
        try {
          const setupAudio = async () => {
            try {
              await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
              })

              // Load and play custom audio if available, otherwise use default
              if (alarmAudioMode === 'custom' && customAudioUrl) {
                try {
                  const { sound } = await Audio.Sound.createAsync(
                    { uri: customAudioUrl },
                    { shouldPlay: true, isLooping: true }
                  )
                  soundRef.current = sound
                } catch (customAudioError) {
                  console.log('Custom audio load failed, falling back to default:', customAudioError)
                }
              }
            } catch (audioError) {
              console.log('Audio init failed:', audioError)
            }
          }
          setupAudio()
        } catch (e) {
          console.log('Audio setup failed:', e)
        }
      }

      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 600, 300, 600], true)
      }

      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 600,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]),
          Animated.sequence([
            Animated.timing(ringAnim1, {
              toValue: 1.3,
              duration: 1200,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(ringAnim1, {
              toValue: 0.8,
              duration: 1200,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]),
          Animated.sequence([
            Animated.timing(ringAnim2, {
              toValue: 1.5,
              duration: 1200,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(ringAnim2, {
              toValue: 0.6,
              duration: 1200,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]),
        ])
      )
      pulse.start()

      return () => {
        if (Platform.OS !== 'web') {
          Vibration.cancel()
        }
        if (soundRef.current) {
          soundRef.current.stopAsync()
          soundRef.current.unloadAsync()
          soundRef.current = null
        }
        pulse.stop()
      }
    }
  }, [visible, status, soundAllowed])

  // Immediate Check-In
  const handleCheckIn = async () => {
    setIsProcessing(true)
    if (Platform.OS !== 'web') {
      Vibration.cancel()
    }
    try {
      if (currentUser) {
        await logWakeUpTime(currentUser.uid, groupId)
        if (emitWakeUp && groupId) {
          emitWakeUp(
            groupId,
            currentUser.displayName || currentUser.email?.split('@')[0],
            new Date().toISOString()
          )
        }
      }
      cancelAlarm()
      setStatus('success')
      setTimeout(() => {
        dismissAlarm()
        setIsProcessing(false)
      }, 1500)
    } catch (err) {
      console.error('Error logging wake-up from alarm:', err)
      dismissAlarm()
      setIsProcessing(false)
    }
  }

  // 1-Click dismiss for buzz alarms
  const handleBuzzDismiss = () => {
    if (Platform.OS !== 'web') {
      Vibration.cancel()
    }
    cancelAlarm()
    dismissAlarm()
  }

  // PIN digit handling for personal alarm dismissal
  const handlePinDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    const next = [...pinDigits]
    next[index] = digit
    setPinDigits(next)
    setPinError('')
    if (digit && index < 3) {
      pinRefs[index + 1]?.current?.focus()
    }
    if (digit && index === 3) {
      const entered = [...next.slice(0, 3), digit].join('')
      handlePinVerify(entered)
    }
  }

  const handlePinKeyPress = (index, e) => {
    if (e.nativeEvent?.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1]?.current?.focus()
    }
  }

  const handlePinVerify = async (override) => {
    const entered = override ?? pinDigits.join('')
    if (entered.length < 4) {
      setPinError('Enter your 4-digit wake-up PIN.')
      return
    }

    let savedPin = ''
    try {
      savedPin = (await AsyncStorage.getItem('suhoor_alarm_pin')) || ''
      if (!savedPin && userProfile?.pin) {
        savedPin = userProfile.pin
      }
    } catch {}

    if (savedPin && entered !== savedPin) {
      setPinError('Incorrect PIN. Try again.')
      setPinDigits(['', '', '', ''])
      setTimeout(() => pinRefs[0]?.current?.focus(), 100)
      return
    }

    setPinError('')
    if (Platform.OS !== 'web') {
      Vibration.cancel()
    }
    cancelAlarm()
    setStatus('success')
    setTimeout(() => {
      dismissAlarm()
    }, 1200)
  }

  if (!visible) return null

  const timeString = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        {/* Top Header: Logo + App Name */}
        <View style={styles.topHeader}>
          <Image
            source={require('../assets/icon-nobg.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="h2" style={styles.brandTitle}>
            Suhoor
          </Text>
        </View>

        {/* Status: SUCCESS */}
        {status === 'success' && (
          <View style={styles.centerContent}>
            <View style={[styles.glowCircle, { backgroundColor: 'rgba(0, 194, 168, 0.2)' }]}>
              <Ionicons name="checkmark-circle" size={90} color="#00C2A8" />
            </View>
            <Text variant="hero" style={styles.mainTitle}>
              {isBuzz ? "You're Checked In!" : 'Alarm Dismissed'}
            </Text>
            <Text variant="bodyLg" style={styles.subtitle}>
              {isBuzz
                ? 'Your group has been notified that you are awake.'
                : 'May Allah bless your day and accept your fast.'}
            </Text>
          </View>
        )}

        {/* Status: RINGING */}
        {status === 'ringing' && (
          <View style={styles.mainLayout}>
            {/* Center Visual */}
            <View style={styles.visualContainer}>
              {/* Background ambient pulse rings */}
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: ringAnim2 }],
                    backgroundColor: isBuzz
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(249, 168, 38, 0.12)',
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: ringAnim1 }],
                    backgroundColor: isBuzz
                      ? 'rgba(239, 68, 68, 0.22)'
                      : 'rgba(249, 168, 38, 0.22)',
                  },
                ]}
              />

              {/* Icon Container */}
              <Animated.View
                style={[
                  styles.iconBox,
                  {
                    transform: [{ scale: pulseAnim }],
                    backgroundColor: isBuzz ? '#EF4444' : brand.secondary,
                  },
                ]}
              >
                <Ionicons
                  name={isBuzz ? 'notifications' : 'alarm'}
                  size={52}
                  color={isBuzz ? '#FFFFFF' : brand.primary}
                />
              </Animated.View>
            </View>

            {/* Readout / Titles */}
            <View style={styles.textBlock}>
              {!isBuzz && (
                <Text style={styles.clockDisplay}>{timeString}</Text>
              )}

              <Text variant="hero" style={styles.mainTitle}>
                {isBuzz ? "You're Being Buzzed!" : 'Your Alarm Rings'}
              </Text>

              <Text variant="bodyLg" style={styles.subtitle}>
                {isBuzz
                  ? `${alarmData?.fromUserName || 'A group member'}${alarmData?.groupName ? ` from ${alarmData.groupName}` : ''} is waking you for Suhoor. Check in on the Groups tab to stop being buzzed.`
                  : 'Your own device alarm is going off. Time to rise for Suhoor and your pre-dawn meal.'}
              </Text>
            </View>

            {/* Bottom Actions */}
            <View style={styles.actionBlock}>
              <Button
                title={isProcessing ? 'Checking In...' : "I Am Awake — Check In"}
                onPress={handleCheckIn}
                loading={isProcessing}
                variant="secondary"
                style={styles.primaryCta}
                textStyle={{ fontSize: 16, fontWeight: '800', color: brand.primary }}
              />

              {isBuzz ? (
                <Button
                  title="Dismiss Buzz"
                  onPress={handleBuzzDismiss}
                  variant="outline"
                  style={styles.secondaryCta}
                  textStyle={{ color: '#F3F4F6' }}
                />
              ) : (
                <Button
                  title="Dismiss Alarm (Enter PIN)"
                  onPress={() => setStatus('dismiss_challenge')}
                  variant="outline"
                  style={styles.secondaryCta}
                  textStyle={{ color: '#9CA3AF' }}
                />
              )}
            </View>
          </View>
        )}

        {/* Status: DISMISS CHALLENGE (4-Digit PIN) */}
        {status === 'dismiss_challenge' && (
          <View style={styles.challengeContainer}>
            <Text variant="h2" style={styles.challengeTitle}>
              Enter Wake-Up PIN
            </Text>
            <Text variant="body" style={styles.challengeSubtitle}>
              Enter your personal 4-digit wake-up PIN to stop and dismiss the alarm.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 24 }}>
              {pinDigits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={pinRefs[i]}
                  value={digit}
                  onChangeText={val => handlePinDigitChange(i, val)}
                  onKeyPress={e => handlePinKeyPress(i, e)}
                  keyboardType="numeric"
                  maxLength={1}
                  secureTextEntry
                  style={{
                    width: 54,
                    height: 60,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: digit ? brand.secondary : 'rgba(255, 255, 255, 0.2)',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#FFFFFF',
                    fontSize: 24,
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}
                  autoFocus={i === 0}
                />
              ))}
            </View>

            {pinError ? (
              <Text style={[styles.errorText, { marginBottom: 16, textAlign: 'center' }]}>{pinError}</Text>
            ) : null}

            <Button
              title="Verify & Stop Alarm"
              onPress={() => handlePinVerify()}
              variant="secondary"
              style={{ marginTop: 12, width: '100%' }}
            />

            <View style={styles.challengeBottom}>
              <Button
                title="Cancel (Back to Alarm)"
                onPress={() => setStatus('ringing')}
                variant="ghost"
                textStyle={{ color: '#9CA3AF' }}
              />
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0826', // Deep indigo night sky
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
    rowGap: 10,
    paddingTop: 30,
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  mainLayout: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: 220,
    height: 220,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  iconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F9A826',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  clockDisplay: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 8,
  },
  mainTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.72)',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
  },
  actionBlock: {
    width: '100%',
    columnGap: 12,
    rowGap: 12,
    paddingBottom: 16,
  },
  primaryCta: {
    backgroundColor: brand.secondary,
    borderRadius: 12,
    height: 54,
  },
  secondaryCta: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    height: 48,
  },
  glowCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  challengeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  challengeSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 30,
    maxWidth: 280,
  },
  tapChallengeBox: {
    alignItems: 'center',
  },
  tapCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapNumber: {
    fontSize: 44,
    fontWeight: '900',
  },
  tapLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  switchMethodText: {
    color: brand.secondary,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dateChallengeBox: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  dateInput: {
    width: '100%',
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  challengeBottom: {
    width: '100%',
    marginTop: 30,
  },
})

export default AlarmOverlay
