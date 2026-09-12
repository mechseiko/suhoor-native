import React from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useTheme } from '../context/ThemeContext'
import { brand } from '../theme'
import { Text } from './ui'

export const AuthWrapper = ({
  children,
  title,
  subtitle,
  error,
  bottomTitle,
  bottomsubTitle,
  onBottomPress,
  onBackPress,
}) => {
  const { colors = {} } = useTheme()

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background || '#FFFFFF' }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 relative">
          {/* Back Button */}
          {onBackPress ? (
            <TouchableOpacity
              onPress={onBackPress}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{
                position: 'absolute',
                top: 16,
                left: 20,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surfaceVariant || '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
              }}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.text || '#111827'}
              />
            </TouchableOpacity>
          ) : null}

          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'flex-end',
              paddingHorizontal: 24,
              paddingTop: 70,
              paddingBottom: 24,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header: Logo beside Titles */}
            <View className="flex-row items-center justify-center mb-20 gap-4">
              <Image
                source={require('../assets/icon-nobg.png')}
                style={{ width: 56, height: 56 }}
                resizeMode="contain"
              />
              <View className="flex-col justify-center">
                <Text
                  variant="h1"
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: colors.text || '#111827' }}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    variant="body"
                    tone="secondary"
                    className="mt-1 text-xs max-w-55"
                    style={{ color: colors.textSecondary || '#6B7280' }}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Error Banner */}
            {error ? (
              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color="#DC2626"
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={{
                    flex: 1,
                    color: '#B91C1C',
                    fontSize: 14,
                    lineHeight: 20,
                    fontWeight: '500',
                  }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Main Form Fields & CTA */}
            <View className="w-full space-y-4">{children}</View>

            {/* Bottom Switcher Link */}
            {bottomTitle ? (
              <View className="flex-row flex-wrap items-center justify-center mt-4 pt-2">
                <Text
                  variant="body"
                  className="text-sm"
                  style={{ color: colors.textSecondary || '#6B7280' }}
                >
                  {bottomTitle}{' '}
                </Text>
                <TouchableOpacity onPress={onBottomPress} hitSlop={10}>
                  <Text
                    variant="label"
                    style={{
                      color: brand.secondary,
                      fontWeight: '700',
                    }}
                    className="text-sm"
                  >
                    {bottomsubTitle}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default AuthWrapper
