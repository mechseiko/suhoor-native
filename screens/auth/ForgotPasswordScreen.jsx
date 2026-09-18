import React, { useState, useEffect } from 'react'
import { View } from 'react-native'
import { sendPasswordResetEmail } from 'firebase/auth'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { auth } from '../../config/firebase'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import AuthWrapper from '../../components/AuthWrapper'
import { Button, Input, Text } from '../../components/ui'

export const ForgotPasswordScreen = ({ navigation }) => {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  // Cooldown timer effect
  useEffect(() => {
    let interval
    if (cooldownRemaining > 0) {
      interval = setInterval(() => {
        setCooldownRemaining(prev => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [cooldownRemaining])

  const handleResetPassword = async () => {
    setError('')
    setSuccess('')

    // Check cooldown
    if (cooldownRemaining > 0) {
      setError(`Please wait ${cooldownRemaining} seconds before requesting another reset link`)
      return
    }

    if (!email) {
      setError(t('auth.enterEmail'))
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError(t('auth.invalidEmail'))
      return
    }

    setLoading(true)

    try {
      await sendPasswordResetEmail(auth, email.trim())
      setSuccess(t('auth.resetLinkSent'))
      setEmail('')
      // Start 30-second cooldown
      setCooldownRemaining(30)
    } catch (err) {
      console.error('Password reset error:', err)
      const errorCode = err.code
      let errorMessage = t('auth.resetError')
      
      if (errorCode === 'auth/user-not-found') {
        errorMessage = t('auth.userNotFound') || 'No account found with this email'
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = t('auth.invalidEmail') || 'Invalid email address'
      } else if (errorCode === 'auth/too-many-requests') {
        errorMessage = t('auth.tooManyRequests') || 'Too many attempts. Please try again later'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthWrapper
      title={t('auth.resetPassword')}
      subtitle={t('auth.resetSubtitle')}
      error={error}
      bottomTitle={t('auth.rememberedPassword')}
      bottomsubTitle={t('auth.login')}
      onBottomPress={() => navigation.navigate('Login')}
      onBackPress={() => navigation.goBack()}
    >
      {success ? (
        <View
          style={{
            backgroundColor: '#ECFDF5',
            borderColor: '#A7F3D0',
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons
            name="checkmark-circle"
            size={20}
            color="#059669"
            style={{ marginRight: 10 }}
          />
          <Text
            style={{
              flex: 1,
              color: '#065F46',
              fontSize: 14,
              lineHeight: 20,
              fontWeight: '500',
            }}
          >
            {success}
          </Text>
        </View>
      ) : null}

      <Input
        label={t('settings.emailAddress')}
        icon="mail-outline"
        placeholder="your@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={{ marginBottom: 20 }}
      />

      <Button
        // title={cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : t('auth.sendResetLink')}
        title={t('auth.sendResetLink')}
        onPress={handleResetPassword}
        loading={loading}
        disabled={cooldownRemaining > 0 || loading}
        variant="primary"
        style={{ borderRadius: 8 }}
      />
    </AuthWrapper>
  )
}

export default ForgotPasswordScreen
