import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { elevation, alpha } from '../../theme'

/**
 * The web app's card, which is one shape used everywhere:
 *
 *   bg-white rounded-xl border border-gray-100 shadow-sm p-4
 *
 * A hairline border doing the structural work and a shadow so faint it only
 * separates the card from the canvas. That restraint is most of why the site
 * reads as calm, so it is the default here and the variants stay close to it.
 *
 * Variants
 * - `default` — white surface, hairline border, `shadow-sm`.
 * - `hero`    — the deep indigo panel (web: the fasting prompt / hero band).
 *               One per screen at most.
 * - `tinted`  — `bg-primary/5 border-primary/20`, the web's welcome banner.
 * - `flat`    — border only, no shadow. For lists of stacked rows.
 */
export const Card = ({
  variant = 'default',
  padded = true,
  style,
  children,
  className,
  ...rest
}) => {
  const { colors } = useTheme()

  const variantStyle = {
    default: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      ...elevation.sm,
      shadowColor: colors.primary,
    },
    hero: {
      backgroundColor: colors.heroSurface,
      borderColor: alpha(colors.white, 0.1),
      ...elevation.md,
    },
    tinted: {
      backgroundColor: alpha(
        colors.primary,
        colors.mode === 'dark' ? 0.14 : 0.05
      ),
      borderColor: alpha(colors.primary, 0.2),
    },
    flat: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  }[variant]

  return (
    <View
      className={`rounded-lg border ${padded ? 'p-4' : ''} ${className ?? ''}`}
      style={StyleSheet.flatten([variantStyle, style])}
      {...rest}
    >
      {children}
    </View>
  )
}

export default Card
