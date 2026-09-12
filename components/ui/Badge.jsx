import React from 'react'
import { StyleSheet, View } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useTheme } from '../../context/ThemeContext'
import Text from './Text'
import { alpha } from '../../theme'

/**
 * The web app's tint-on-tint pill:
 *
 *   text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary
 *
 * A 10%-alpha fill of the same hue as the text, sometimes with a 20% border
 * (StatsCard's icon tile does exactly this). No solid colour blocks, which is
 * why the dashboard stays quiet even with several statuses on screen.
 */
export const Badge = ({
  label,
  tone = 'primary',
  icon,
  bordered = false,
  pill = true,
  style,
  className,
}) => {
  const { colors } = useTheme()

  const hue = {
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    neutral: colors.textSecondary,
  }[tone]

  return (
    <View
      className={`flex-row items-center self-start gap-1 px-2 py-[3px] ${className ?? ''}`}
      style={StyleSheet.flatten([
        {
          backgroundColor: alpha(hue, 0.1),
          borderRadius: pill ? 999 : 4,
          borderWidth: bordered ? 1 : 0,
          borderColor: bordered ? alpha(hue, 0.2) : 'transparent',
        },
        style,
      ])}
    >
      {icon && <Ionicons name={icon} size={12} color={hue} />}
      <Text variant="badge" color={hue}>
        {label}
      </Text>
    </View>
  )
}

export default Badge
