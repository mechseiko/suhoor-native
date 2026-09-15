/**
 * Semantic themes — the names screens actually consume (`colors.surface`,
 * `colors.textSecondary`, …) mapped onto the brand tokens.
 *
 * ## Light is the web app, verbatim
 *
 * The site's `body` is `bg-white` with `--color-dark` text; dashboard content
 * sits on a barely-there `bg-gray-50/30` canvas with white cards over it,
 * each card carrying a `border-gray-100` hairline plus `shadow-sm`. That is
 * reproduced here exactly — `background` is the gray-50 canvas, `surface` is
 * the white card.
 *
 * ## Dark is a derivation, not an invention
 *
 * The web app has no dark mode, so there is nothing to copy. Rather than pick
 * new hues, dark mode is built from the brand's own deep indigo: `#150C33` is
 * the hero background on the marketing site, so it becomes the app background,
 * and the surfaces are that same hue lifted in lightness. Nothing new enters
 * the palette.
 *
 * One deliberate swap: `primary` is near-black, which cannot serve as an
 * accent on a dark ground (invisible fills, failing contrast on text). Dark
 * mode therefore promotes the brand's existing **secondary amber** to the
 * interactive accent — the pairing the hero already uses (amber CTA on indigo)
 * — instead of importing a lighter violet. `primaryFill` names the color to
 * paint a filled button with, so components don't need to branch on mode.
 */

import { brand, neutral, status, alpha, spacing, radius, elevation } from './tokens'
import typography, {
  text,
  size,
  weight,
  lineHeight,
  font,
  roleFamily,
  FONTS_LINKED,
} from './typography'
import { fontAssets } from './fonts'

export const lightTheme = {
  mode: 'light',

  // Brand
  primary: brand.primary,
  secondary: brand.secondary,
  accent: brand.accent,

  /** Background of a filled primary button, and the text that goes on it. */
  primaryFill: brand.primary,
  onPrimaryFill: neutral.white,
  /** Filled secondary/CTA. Amber never takes white text — see `onSecondary`. */
  secondaryFill: brand.secondary,
  onSecondaryFill: brand.primary,

  // Canvas + surfaces (web: bg-gray-50/30 canvas, white cards)
  background: neutral.white,
  surface: neutral.white,
  surfaceVariant: neutral.gray100,
  /** The deep indigo panel — the web hero and the fasting prompt card. */
  heroSurface: brand.primary,
  onHeroSurface: neutral.white,

  // Text
  text: neutral.gray900,
  textBody: brand.dark,
  textSecondary: neutral.gray500,
  muted: neutral.gray400,

  // Lines
  border: neutral.gray100,
  borderStrong: neutral.gray200,

  // Status
  success: status.success,
  warning: status.warning,
  error: status.error,
  info: brand.primary,

  white: neutral.white,
  overlay: alpha(brand.primary, 0.6),
}

export const darkTheme = {
  mode: 'dark',

  // Amber leads in dark mode; the indigo stays as the brand's ground colour.
  primary: brand.secondary,
  secondary: brand.secondary,
  accent: brand.accent,

  primaryFill: brand.secondary,
  onPrimaryFill: brand.primary,
  secondaryFill: brand.secondary,
  onSecondaryFill: brand.primary,

  // Indigo, lifted in steps. `#150C33` is the site's own hero background.
  background: '#0F0824',
  surface: '#1B1140',
  surfaceVariant: '#271A55',
  heroSurface: '#1B1140',
  onHeroSurface: neutral.white,

  text: '#F5F3FF',
  textBody: '#E7E3F5',
  textSecondary: '#A79FC4',
  muted: '#8078A0',

  border: '#33245F',
  borderStrong: '#453473',

  success: status.successDark,
  warning: brand.secondary,
  error: status.errorDark,
  info: brand.secondary,

  white: neutral.white,
  overlay: 'rgba(6, 3, 16, 0.78)',
}

export const themes = { light: lightTheme, dark: darkTheme }

export {
  brand,
  neutral,
  status,
  alpha,
  spacing,
  radius,
  elevation,
  typography,
  text,
  size,
  weight,
  lineHeight,
  font,
  roleFamily,
  fontAssets,
  FONTS_LINKED,
}

export default themes
