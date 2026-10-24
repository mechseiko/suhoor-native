import React from 'react'
import { StyleSheet, View } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useTheme } from '../../context/ThemeContext'
import { alpha } from '../../theme'

/**
 * The rounded, tinted icon square from the web `StatsCard`:
 *
 *   p-3 rounded-xl bg-primary/10 text-primary border-primary/20
 *
 * Used at the top-left of a card to say what the card is about. `size` is the
 * tile edge; the glyph is sized proportionally so it stays optically centred.
 */
export const IconTile = ({
  icon,
  tone = 'primary',
  size = 40,
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
      style={StyleSheet.flatten([
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          borderWidth: 1,
          backgroundColor: alpha(hue, 0.1),
          borderColor: alpha(hue, 0.2),
        },
        style,
      ])}
    >
      <Ionicons name={icon} size={Math.round(size * 0.45)} color={hue} />
    </View>
  )
}

export default IconTile
