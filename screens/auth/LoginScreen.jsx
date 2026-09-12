import React, { useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useTheme } from '../../context/ThemeContext'
import AuthWrapper from '../../components/AuthWrapper'
import { Button, Input, Text } from '../../components/ui'

export const LoginScreen = ({ navigation }) => {
  const { t } = useLanguage()
  const { colors } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('auth.fillAllFields'))
      return
    }

    setError('')
    setLoading(true)

    try {
      await login(email.trim(), password)
    } catch (err) {
      console.error('Login error:', err)
      const errorCode = err.code
      let errorMessage = t('auth.loginError')
      
      if (errorCode === 'auth/user-not-found') {
        errorMessage = t('auth.userNotFound') || 'No account found with this email'
      } else if (errorCode === 'auth/wrong-password') {
        errorMessage = t('auth.wrongPassword') || 'Incorrect password'
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = t('auth.invalidEmail') || 'Invalid email address'
      } else if (errorCode === 'auth/user-disabled') {
        errorMessage = t('auth.userDisabled') || 'This account has been disabled'
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
      title={t('auth.welcomeBack')}
      subtitle={t('auth.loginSubtitle')}
      error={error}
      bottomTitle={t('auth.dontHaveAccount')}
      bottomsubTitle={t('auth.signup')}
      onBottomPress={() => navigation.navigate('Signup')}
    >
      <Input
        label={t('settings.emailAddress')}
        icon="mail-outline"
        placeholder="your@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Input
        label={t('auth.password')}
        icon="lock-closed-outline"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={{ marginBottom: 1 }}
      />

      <View className="mb-8 items-end">
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
        variant="primary"
        style={{ borderRadius: 8 }}
      />
    </AuthWrapper>
  )
}

export default LoginScreen
