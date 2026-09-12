import React from 'react'
import { Platform, StyleSheet, Text as RNText } from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { text as textRoles, roleFamily, font } from '../../theme'

/**
 * Text with the design system's roles built in.
 *
 *   <Text variant="h2">Fasting History</Text>
 *   <Text variant="caption">Your consistency over time</Text>
 *
 * `variant` picks family + size + weight + line height from `theme/typography`,
 * so no screen has to name a font size. The color comes from the active theme
 * (the role's own token colour is overridden, since the roles are declared
 * against the light palette) and `tone` selects which slot to read.
 *
 * Available variants: hero, display, h1, h2, h3, bodyLg, body, label, caption,
 * eyebrow, button, badge, and `inherit`.
 *
 * ## Why the role is filtered against `className`
 *
 * The role has to reach React Native through the `style` prop, and NativeWind
 * ranks the `style` prop as an *inline* style — above every class, whatever the
 * class says. So `<Text className="text-[29px] font-bold">` used to render at
 * the default body role's 14px: the class compiled correctly and then lost.
 * That is what made font sizes look like they "don't work", and it was silent.
 *
 * So before the role is applied, any property the call site has already declared
 * through `className` is dropped from it. `className`, the `style` prop and
 * `variant` now compose the way they read at the call site, in that order of
 * precedence (`style` still wins over `className`, as in CSS).
 *
 * `variant="inherit"` emits no typography and no colour at all — use it for a
 * coloured run *inside* another `Text`, which is the other way a size gets lost:
 * a nested `<Text>` with its own `fontSize` overrides what it should inherit.
 */
export const Text = ({
  variant = 'body',
  tone = 'default',
  color,
  style,
  className,
  children,
  ...rest
}) => {
  const { colors } = useTheme()
  const role = variant === 'inherit' ? null : textRoles[variant] ?? textRoles.body

  const toneColor = {
    default: HEADING_VARIANTS.has(variant) ? colors.text : colors.textBody,
    secondary: colors.textSecondary,
    muted: colors.muted,
    primary: colors.primary,
    secondaryBrand: colors.secondary,
    accent: colors.accent,
    success: colors.success,
    error: colors.error,
    /** On a `hero` Card or any filled brand surface. */
    onHero: colors.onHeroSurface,
    onFill: colors.onPrimaryFill,
  }[tone]

  const resolved = role ? resolveRole(role, variant, className) : null

  // A class-declared colour has to be left alone too, or `text-gray-500` loses
  // to the tone. An explicit `color` prop or `tone` still wins — those are
  // deliberate, a leftover utility class usually isn't.
  const wantsColor =
    color !== undefined ||
    tone !== 'default' ||
    (variant !== 'inherit' && !COLOR_CLASS.test(className ?? ''))

  return (
    <RNText
      style={StyleSheet.flatten([
        resolved,
        wantsColor ? { color: color ?? toneColor } : null,
        style,
      ])}
      className={className}
      {...rest}
    >
      {children}
    </RNText>
  )
}

// Roles that should take the stronger heading colour rather than body text.
const HEADING_VARIANTS = new Set(['hero', 'display', 'h1', 'h2', 'h3', 'label'])

/**
 * Tailwind's font-size steps, plus the arbitrary form (`text-[29px]`). Kept
 * separate from the colour pattern because both spell `text-`.
 */
const SIZE_CLASS =
  /(?:^|\s)text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[0-9.]+(?:px|rem|em)?\])(?=\s|$)/
const LEADING_CLASS = /(?:^|\s)leading-\S+/
const FAMILY_CLASS = /(?:^|\s)font-(?:body|heading)(?:-(?:medium|semibold|bold))?(?=\s|$)/
const WEIGHT_CLASS =
  /(?:^|\s)font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?=\s|$)/
const COLOR_CLASS =
  /(?:^|\s)text-(?:\[#[0-9a-fA-F]{3,8}\]|white|black|transparent|primary|secondary|accent|ink|canvas|[a-z]+-\d{2,3})(?=\s|$)/

/** Tailwind's nine weights collapsed onto the four faces we actually ship. */
const CLASS_WEIGHT = {
  thin: '400',
  extralight: '400',
  light: '400',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '700',
  black: '700',
}

const resolveRole = (role, variant, className) => {
  const cls = className ?? ''
  if (!cls) return role

  const next = { ...role }

  // A size class carries its own line height in Tailwind, so both go.
  if (SIZE_CLASS.test(cls)) {
    delete next.fontSize
    delete next.lineHeight
  }
  if (LEADING_CLASS.test(cls)) delete next.lineHeight
  if (FAMILY_CLASS.test(cls)) delete next.fontFamily

  const classWeight = CLASS_WEIGHT[WEIGHT_CLASS.exec(cls)?.[1]]
  if (classWeight) {
    // Re-point the family at the matching face rather than letting the class's
    // numeric weight land on a Regular file: on Android that is what produces a
    // synthesised bold sitting next to the real Quicksand-Bold elsewhere.
    Object.assign(next, font(roleFamily[variant] ?? 'body', classWeight))
    if (Platform.OS === 'android') next.fontWeight = 'normal'
  }

  return next
}

export default Text
