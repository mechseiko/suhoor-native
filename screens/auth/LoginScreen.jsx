import React, { useState, useEffect } from 'react'
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
import { doc, updateDoc, getDoc } from 'firebase/firestore'

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

  useEffect(() => {
    const loadCachedUser = async () => {
      try {
        const storedName = await AsyncStorage.getItem('suhoor_last_display_name')
        const storedEmail = await AsyncStorage.getItem('suhoor_last_email')
        if (storedName) setCachedDisplayName(storedName)
        if (storedEmail) {
          setCachedEmail(storedEmail)
          setEmail(storedEmail)
        }
      } catch (err) {
        console.log('Error loading cached user:', err)
      }
    }
    loadCachedUser()
  }, [])

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

      // Check Firebase Auth verification status first
      if (!user.emailVerified) {
        // Even if Firebase says not verified, check Firestore profile
        // to handle the case where the user just verified but Auth hasn't synced yet
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const userProfileDoc = await getDoc(doc(db, COLLECTIONS.profiles, user.uid))
        const isProfileVerified = userProfileDoc.exists() ? userProfileDoc.data().isVerified : false
        
        if (!isProfileVerified) {
          // Both Firebase and Firestore say not verified
          await logout()
          setError(t('auth.emailNotVerified'))
          return
        }
        // If Firestore says verified but Firebase doesn't, proceed
        // AuthContext will sync the status
      }

      // Sync alarm PIN from AsyncStorage to profile if it exists
      try {
        const alarmPin = await AsyncStorage.getItem('suhoor_alarm_pin')
        if (alarmPin) {
          const profileRef = doc(db, COLLECTIONS.profiles, user.uid)
          await updateDoc(profileRef, { pin: alarmPin })
        }
      } catch (syncErr) {
        console.log('Error syncing alarm PIN:', syncErr)
      }

      // Cache user data for next login
      try {
        const profileDoc = await getDoc(doc(db, COLLECTIONS.profiles, user.uid))
        if (profileDoc.exists()) {
          const profileData = profileDoc.data()
          await AsyncStorage.setItem('suhoor_last_display_name', profileData.display_name || user.email.split('@')[0])
          await AsyncStorage.setItem('suhoor_last_email', user.email)
        }
      } catch (cacheErr) {
        console.log('Error caching user data:', cacheErr)
      }

      // Navigate to main app on successful login
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
        errorMessage = t('auth.invalidCredentials')
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

      // Sync alarm PIN from AsyncStorage to profile if it exists
      try {
        const alarmPin = await AsyncStorage.getItem('suhoor_alarm_pin')
        if (alarmPin) {
          const profileRef = doc(db, COLLECTIONS.profiles, user.uid)
          await updateDoc(profileRef, { pin: alarmPin })
        }
      } catch (syncErr) {
        console.log('Error syncing alarm PIN on Google sign-in:', syncErr)
      }

      // Cache user data for next login
      try {
        const profileDoc = await getDoc(doc(db, COLLECTIONS.profiles, user.uid))
        if (profileDoc.exists()) {
          const profileData = profileDoc.data()
          await AsyncStorage.setItem('suhoor_last_display_name', profileData.display_name || user.email.split('@')[0])
          await AsyncStorage.setItem('suhoor_last_email', user.email)
        }
      } catch (cacheErr) {
        console.log('Error caching user data:', cacheErr)
      }

      // Navigate to main app on successful Google login
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
        err.code === 'SIGN_IN_CANCELLED' // <-- ADDED THIS NATIVE ERROR CODE
      ) {
        errorMessage = t('auth.googleSignInCancelled', 'Sign-in cancelled')
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = t('auth.popupBlocked', 'Sign-in popup was blocked. Please allow popups.')
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = t('auth.networkError')
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthWrapper
      title={cachedDisplayName ? t('auth.welcomeBackName', { name: cachedDisplayName }) : t('auth.welcomeBack')}
      subtitle={cachedDisplayName ? t('auth.loginSubtitle') : t('auth.loginSubtitle')}
      error={error}
      bottomTitle={t('auth.dontHaveAccount')}
      bottomsubTitle={t('auth.signup')}
      onBottomPress={() => navigation.navigate('Signup')}
    >
      {showEmailInput ? (
        <Input
          label={t('settings.emailAddress')}
          icon="mail-outline"
          placeholder={t("auth.emailPlaceholder", "your@email.com")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : (
        <TouchableOpacity onPress={() => setShowEmailInput(true)} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.primary, fontSize: 13 }}>
            {t('auth.notYou', 'Not ' + (cachedDisplayName || cachedEmail) + '?')}
          </Text>
        </TouchableOpacity>
      )}

      <Input
        label={t('auth.password')}
        icon="lock-closed-outline"
        placeholder={t("auth.passwordPlaceholder", "••••••••")}
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={{ marginBottom: 1 }}
      />

      <View style={{ marginBottom: 32, alignItems: 'flex-end' }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          hitSlop={10}
        >
          <Text
            style={{ color: colors.primary, fontWeight: '500', fontSize: 13.5 }}
          >
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginVertical: 12,
        }}
      >
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: colors.border || '#E5E7EB',
          }}
        />
        <Text
          style={{
            marginHorizontal: 16,
            color: colors.textTertiary || '#6B7280',
            fontSize: 14,
            fontWeight: '400',
          }}
        >
          {t('auth.or', 'or')}
        </Text>
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: colors.border || '#E5E7EB',
          }}
        />
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
          opacity: (googleLoading || loading) ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color={isDark ? colors.text : '#374151'} />
        ) : (
          <>
            <GoogleIcon size={20} />
            <Text
              style={{
                color: isDark ? colors.text : '#374151',
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              {t('auth.signInWithGoogle', 'Sign in with Google')}
            </Text>
          </>
        )}
      </Pressable>
    </AuthWrapper>
  )
}

export default LoginScreen