import React, { useState, useEffect, useRef } from 'react'
import { ActivityIndicator, Pressable, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useTheme } from '../../context/ThemeContext'
import AuthWrapper from '../../components/AuthWrapper'
import { Button, Input, Text } from '../../components/ui'
import { GoogleIcon } from '../../components/GoogleIcon'
import { db } from '../../config/firebase'
import { COLLECTIONS } from '../../config/firestoreSchema'
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore'

const CACHE_KEYS = {
  NAME: 'suhoor_last_display_name',
  EMAIL: 'suhoor_last_email',
}

// Masks an email for display: "ahmed.khan@gmail.com" -> "a***@gmail.com"
const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return ''
  const [local, domain] = email.split('@')
  if (!local) return `***@${domain}`
  const visible = local.slice(0, 1)
  return `${visible}***@${domain}`
}

// Safely derives a display name from a user object, never throws.
const deriveDisplayName = (user, profileData) => {
  const fromProfile = profileData?.display_name
  if (fromProfile && String(fromProfile).trim()) return String(fromProfile).trim()

  const fromAuth = user?.displayName
  if (fromAuth && String(fromAuth).trim()) return String(fromAuth).trim()

  const email = user?.email || ''
  const fromEmail = email.split('@')[0]
  if (fromEmail && fromEmail.trim()) return fromEmail.trim()

  return ''
}

export const LoginScreen = ({ navigation }) => {
  const { t } = useLanguage()
  const { colors, isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { login, logout, signInWithGoogle } = useAuth()
  const [cachedDisplayName, setCachedDisplayName] = useState('')
  const [cachedEmail, setCachedEmail] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)

  // Guards against the async cache read clobbering what the user is typing.
  const emailTouchedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const loadCachedUser = async () => {
      try {
        const [storedName, storedEmail] = await Promise.all([
          AsyncStorage.getItem(CACHE_KEYS.NAME),
          AsyncStorage.getItem(CACHE_KEYS.EMAIL),
        ])
        if (cancelled) return
        if (storedName) setCachedDisplayName(storedName)
        if (storedEmail) {
          setCachedEmail(storedEmail)
          // Only seed the input if the user hasn't started typing.
          if (!emailTouchedRef.current) {
            setEmail((prev) => prev || storedEmail)
          }
        }
      } catch (err) {
        console.log('Error loading cached user:', err)
      }
    }
    loadCachedUser()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist cache safely (never throws, never writes empty strings).
  const persistCache = async (user, profileData) => {
    try {
      const name = deriveDisplayName(user, profileData)
      const emailVal = user?.email || profileData?.email || ''
      const writes = []
      if (name) writes.push(AsyncStorage.setItem(CACHE_KEYS.NAME, name))
      if (emailVal) writes.push(AsyncStorage.setItem(CACHE_KEYS.EMAIL, emailVal))
      if (writes.length) await Promise.all(writes)
    } catch (cacheErr) {
      console.log('Error caching user data:', cacheErr)
    }
  }

  // Sync alarm PIN from AsyncStorage to profile if it exists.
  // Uses setDoc-with-merge so it works even if the profile doc doesn't exist yet.
  const syncAlarmPin = async (uid) => {
    try {
      const alarmPin = await AsyncStorage.getItem('suhoor_alarm_pin')
      if (!alarmPin) return
      const profileRef = doc(db, COLLECTIONS.profiles, uid)
      await setDoc(profileRef, { pin: alarmPin }, { merge: true })
    } catch (syncErr) {
      console.log('Error syncing alarm PIN:', syncErr)
    }
  }

  // Returns { verified, profileData }.
  // Fast path: Firebase Auth already says verified -> return immediately, no Firestore read.
  // Slow path: unverified by Auth -> read Firestore (source of truth) + bounded retry.
  const checkVerification = async (user) => {
    // Fast path: no await before this return.
    if (user.emailVerified) return { verified: true, profileData: null }

    let profileData = null
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.profiles, user.uid))
      profileData = snap.exists() ? snap.data() : null
    } catch (e) {
      console.log('Error reading profile for verification:', e)
    }

    if (profileData?.isVerified === true) return { verified: true, profileData }

    // One short retry in case the user just verified and state is still propagating.
    await new Promise((r) => setTimeout(r, 600))
    try {
      await user.reload?.()
      if (user.emailVerified) return { verified: true, profileData }
      const snap2 = await getDoc(doc(db, COLLECTIONS.profiles, user.uid))
      const pd2 = snap2.exists() ? snap2.data() : null
      if (pd2?.isVerified === true) return { verified: true, profileData: pd2 }
      return { verified: false, profileData: pd2 || profileData }
    } catch (e) {
      return { verified: false, profileData }
    }
  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('auth.fillAllFields'))
      return
    }

    setError('')
    setLoading(true)

    try {
      const userCredential = await login(email.trim(), password)
      const user = userCredential.user

      const { verified, profileData } = await checkVerification(user)
      if (!verified) {
        await logout()
        setError(t('auth.emailNotVerified'))
        return
      }

      await syncAlarmPin(user.uid)
      await persistCache(user, profileData)

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    } catch (err) {
      console.error('Login error:', err)
      const errorCode = err.code
      let errorMessage = t('auth.loginError')

      if (
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/invalid-login-credentials'
      ) {
        errorMessage = t('auth.invalidCredentialsGoogleHint')
      } else if (errorCode === 'auth/user-not-found') {
        errorMessage = t('auth.userNotFound')
      } else if (errorCode === 'auth/wrong-password') {
        errorMessage = t('auth.wrongPassword')
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = t('auth.invalidEmail')
      } else if (errorCode === 'auth/user-disabled') {
        errorMessage = t('auth.userDisabled')
      } else if (errorCode === 'auth/too-many-requests') {
        errorMessage = t('auth.tooManyRequests')
      } else if (errorCode === 'auth/network-request-failed') {
        errorMessage = t('auth.networkError')
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setGoogleLoading(true)

    try {
      const userCredential = await signInWithGoogle()
      const user = userCredential.user

      // Google accounts are verified by Google. But if the app gates on
      // Firestore `isVerified`, respect that too.
      let profileData = null
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.profiles, user.uid))
        profileData = snap.exists() ? snap.data() : null
      } catch (e) {
        console.log('Error reading profile after Google sign-in:', e)
      }
      if (profileData && profileData.isVerified === false) {
        await logout()
        setError(t('auth.emailNotVerified'))
        return
      }

      await syncAlarmPin(user.uid)
      await persistCache(user, profileData)

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    } catch (err) {
      console.error('Google sign-in error:', err)
      let errorMessage = t('auth.googleSignInError', 'Failed to sign in with Google')

      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request' ||
        err.code === 'SIGN_IN_CANCELLED'
      ) {
        errorMessage = t('auth.googleSignInCancelled', 'Sign-in cancelled')
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = t('auth.signInPopupBlocked')
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = t('auth.networkError')
      } else if (err.code === 'auth/provider-password') {
        // This email belongs to an email/password account; Google is not allowed
        // for it (one provider per email).
        errorMessage = t('auth.providerPasswordOnly')
      } else if (err.code === 'auth/account-conflict') {
        errorMessage = t('auth.accountConflict')
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setGoogleLoading(false)
    }
  }

  // "Not you?" — switch account. Clears the cached greeting locally so the
  // header doesn't contradict the form. Cache keys are left intact so that if
  // the user backs out, next mount restores the greeting.
  const handleNotYou = () => {
    setShowEmailInput(true)
    setCachedDisplayName('')
    setCachedEmail('')
    setError('')
  }

  const handleEmailChange = (val) => {
    emailTouchedRef.current = true
    setEmail(val)
  }

  const showCachedFlow = !!(cachedDisplayName || cachedEmail)
  const showEmailField = !showCachedFlow || showEmailInput
  const greetingName = cachedDisplayName || ''

  return (
    <AuthWrapper
      title={
        greetingName
          ? t('auth.welcomeBackName', { name: greetingName })
          : t('auth.welcomeBack')
      }
      subtitle={t('auth.loginSubtitle')}
      error={error}
      bottomTitle={t('auth.dontHaveAccount')}
      bottomsubTitle={t('auth.signup')}
      onBottomPress={() => navigation.navigate('Signup')}
    >
      {showEmailField && (
        <Input
          label={t('settings.emailAddress')}
          icon="mail-outline"
          placeholder={t('auth.emailPlaceholder', 'your@email.com')}
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      <Input
        label={t('auth.password')}
        icon="lock-closed-outline"
        placeholder={t('auth.passwordPlaceholder', '••••••••')}
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={{ marginBottom: 1 }}
      />

      {showCachedFlow && !showEmailInput && (
        <TouchableOpacity
          onPress={handleNotYou}
          hitSlop={8}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
        >
          <Text style={{ color: colors.primary, fontSize: 13 }}>
            {t('auth.notYou', {
              name: cachedDisplayName || maskEmail(cachedEmail),
            })}
          </Text>
        </TouchableOpacity>
      )}

      <View style={{ marginBottom: 16, marginTop: 8, alignItems: 'flex-end' }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          hitSlop={10}
        >
          <Text style={{ color: colors.primary, fontWeight: '500', fontSize: 13.5 }}>
            {t('auth.forgotPassword')}
          </Text>
        </TouchableOpacity>
      </View>

      <Button
        title={t('auth.login')}
        onPress={handleLogin}
        loading={loading}
        disabled={googleLoading}
        variant="primary"
        style={{ borderRadius: 8 }}
      />

      {/* Divider */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border || '#E5E7EB' }} />
        <Text style={{ marginHorizontal: 16, color: colors.textTertiary || '#6B7280', fontSize: 14, fontWeight: '400' }}>
          {t('auth.or', 'or')}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border || '#E5E7EB' }} />
      </View>

      {/* Google Sign In Button */}
      <Pressable
        onPress={handleGoogleSignIn}
        disabled={googleLoading || loading}
        accessibilityRole="button"
        style={({ pressed }) => ({
          height: 50,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: isDark ? colors.border : '#D1D5DB',
          backgroundColor: isDark ? colors.surface || '#1F2937' : '#FFFFFF',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          columnGap: 10,
          opacity: googleLoading || loading ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color={isDark ? colors.text : '#374151'} />
        ) : (
          <>
            <GoogleIcon size={20} />
            <Text style={{ color: isDark ? colors.text : '#374151', fontWeight: '500', fontSize: 15 }}>
              {t('auth.signInWithGoogle', 'Sign in with Google')}
            </Text>
          </>
        )}
      </Pressable>
    </AuthWrapper>
  )
}

export default LoginScreen