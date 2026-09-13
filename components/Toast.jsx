import React, { useEffect, useRef } from 'react'
import { Text, Animated, View, Platform, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import Ionicons from 'react-native-vector-icons/Ionicons'

export const Toast = ({
  message,
  type = 'info',
  visible,
  onDismiss,
  duration = 3000,
}) => {
  const { colors, isDark } = useTheme()
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start()

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }).start(() => onDismiss())
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!visible) return null

  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          bg: isDark ? '#132D24' : '#E6F8F3',
          border: colors.success,
          text: isDark ? '#D1FAE5' : '#064E3B',
          icon: 'checkmark-done-circle',
          iconColor: colors.success,
        }
      case 'error':
        return {
          bg: isDark ? '#3C1A1A' : '#FEF2F2',
          border: colors.error,
          text: isDark ? '#FEE2E2' : '#991B1B',
          icon: 'alert-circle',
          iconColor: colors.error,
        }
      case 'warning':
        return {
          bg: isDark ? '#3B2510' : '#FFFBEB',
          border: colors.warning,
          text: isDark ? '#FEF3C7' : '#92400E',
          icon: 'warning',
          iconColor: colors.warning,
        }
      case 'info':
      default:
        return {
          bg: isDark ? '#131C35' : '#EFF6FF',
          border: colors.primary,
          text: isDark ? '#DBEAFE' : '#1E3A8A',
          icon: 'information-circle',
          iconColor: colors.primary,
        }
    }
  }

  const theme = getTheme()

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          backgroundColor: theme.bg,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.row}>
        <Ionicons
          name={theme.icon}
          size={22}
          color={theme.iconColor}
          style={{ marginEnd: 10 }}
        />
        <Text
          style={[styles.message, { color: theme.text }]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 50,
    zIndex: 9999,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
})

export default Toast
