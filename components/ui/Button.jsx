import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useTheme } from '../../context/ThemeContext'
import Text from './Text'
import { alpha, brand, neutral } from '../../theme'

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
  ...rest
}) => {
  const { colors = {} } = useTheme()
  const isDisabled = disabled || loading

  const palette = {
    primary: {
      background: colors.primaryFill || brand.primary,
      border: 'transparent',
      borderWidth: 0,
      content: colors.onPrimaryFill || neutral.white,
    },
    secondary: {
      background: brand.secondary,
      border: 'transparent',
      borderWidth: 0,
      content: brand.primary,
    },
    outline: {
      background: 'transparent',
      border: colors.primary || brand.primary,
      borderWidth: 1.5,
      content: colors.primary || brand.primary,
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      borderWidth: 0,
      content: colors.textSecondary || neutral.gray500,
    },
    danger: {
      background: 'transparent',
      border: colors.error || '#EF4444',
      borderWidth: 1.5,
      content: colors.error || '#EF4444',
    },
  }[variant] || {
    background: brand.primary,
    border: 'transparent',
    borderWidth: 0,
    content: neutral.white,
  }

  const sizeStyle = size === 'sm'
    ? { height: 44, paddingHorizontal: 16 }
    : { height: 52, paddingHorizontal: 20 }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          borderWidth: palette.borderWidth,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        StyleSheet.flatten(style),
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.content} />
      ) : (
        <View style={styles.inner}>
          {icon && iconPosition === 'start' && (
            <Ionicons name={icon} size={16} color={palette.content} />
          )}
          <Text
            variant="button"
            style={[styles.label, { color: palette.content }, textStyle]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'end' && (
            <Ionicons name={icon} size={16} color={palette.content} />
          )}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
})

export default Button
