/**
 * Typography — the web app's two families and its actual type scale.
 *
 * `src/index.css` declares exactly two families and gives them distinct roles:
 *
 *   --font-body:    'Quicksand'      → body text (set on <body>)
 *   --font-heading: 'Space Grotesk'  → h1–h6 (set in the @layer base block)
 *
 * Keep that split. Headings, numeric readouts and button labels take
 * `heading`; running text, form fields and captions take `body`.
 *
 * The scale below is the web app's own, not an inflated "mobile" one. Measured
 * usage across `src/**` is dominated by the small end — text-xs (182 uses) and
 * text-sm (167) carry most of the UI, with text-lg/xl for section titles and
 * text-2xl/3xl reserved for a single figure per card. Mobile keeps those
 * values: a 14px row on the web is a 14px row here.
 */

import { Platform } from 'react-native'
import { brand, neutral } from './tokens'

/**
 * Whether the bundled Quicksand / Space Grotesk binaries are registered with the
 * native runtime.
 *
 * Naming a `fontFamily` Android cannot resolve makes the text silently fall
 * back to a default face *and* drops the numeric `fontWeight`, which reads as
 * a random font rather than a graceful degradation. So the families are only
 * emitted once the assets are actually in place.
 *
 * They are: the eight .ttf files live in `assets/fonts/` and `App.jsx` loads
 * them through `expo-font` (`theme/fonts.js`) before the first render. Note that
 * the `@font-face` rules in `global.css` are **not** what does this — NativeWind
 * only compiles those for web.
 */
export const FONTS_LINKED = true

const FAMILY = {
  body: {
    regular: 'Quicksand-Regular',
    medium: 'Quicksand-Medium',
    semibold: 'Quicksand-SemiBold',
    bold: 'Quicksand-Bold',
  },
  heading: {
    regular: 'SpaceGrotesk-Regular',
    medium: 'SpaceGrotesk-Medium',
    semibold: 'SpaceGrotesk-SemiBold',
    bold: 'SpaceGrotesk-Bold',
  },
}

/**
 * Tailwind's numeric weights, which is what the web classes compile to.
 * The web app uses four: medium (84 uses), semibold (137), bold (198), and
 * regular for running text.
 */
export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

const WEIGHT_KEY = {
  400: 'regular',
  500: 'medium',
  600: 'semibold',
  700: 'bold',
}

/**
 * Resolve a (role, weight) pair to the style props a `Text` needs.
 *
 * On Android a custom family encodes its own weight in the file name, so the
 * `fontWeight` prop must be dropped or the system synthesises a second layer
 * of boldness on top. iOS is happy with both. When fonts aren't linked we
 * return the weight alone and let the platform face carry it.
 */
export const font = (role = 'body', w = weight.regular) => {
  const key = WEIGHT_KEY[Number(w)] ?? 'regular'

  if (!FONTS_LINKED) {
    return { fontWeight: w }
  }

  const family = (FAMILY[role] ?? FAMILY.body)[key]

  return { fontFamily: family, fontWeight: w }
}

/**
 * Font sizes, named by the Tailwind step they mirror so a web class maps
 * straight across: `text-sm` → `size.sm`.
 */
export const size = {
  micro: 10, // text-[10px] — the web's uppercase eyebrow labels
  xs: 12, // text-xs
  sm: 14, // text-sm  ← the workhorse
  base: 16, // text-base
  lg: 18, // text-lg
  xl: 20, // text-xl — dashboard page title on mobile widths
  xxl: 24, // text-2xl
  xxxl: 30, // text-3xl — StatsCard's single big figure
  hero: 32, // one full-screen headline: onboarding, empty states
}

/**
 * Line heights. The web relies on Tailwind's defaults plus `leading-relaxed`
 * on prose; these are the equivalent absolute values.
 */
export const lineHeight = {
  micro: 14,
  xs: 16,
  sm: 20,
  base: 24,
  lg: 26,
  xl: 28,
  xxl: 30,
  xxxl: 36,
  hero: 41,
}

/**
 * Ready-made text roles. Prefer these over assembling size + weight inline —
 * it's what keeps the hierarchy identical from screen to screen.
 */
export const text = {
  /**
   * The one headline that owns a whole screen — an onboarding step, a full-page
   * empty state. Larger than `display` on purpose: `display` is a figure inside
   * a card, this is the only thing on the screen.
   */
  hero: {
    ...font('heading', weight.bold),
    fontSize: size.hero,
    lineHeight: lineHeight.hero,
    letterSpacing: -0.6,
    color: neutral.gray900,
  },
  /** One number or time per card, at most. Web: StatsCard `text-3xl font-bold`. */
  display: {
    ...font('heading', weight.bold),
    fontSize: size.xxxl,
    lineHeight: lineHeight.xxxl,
    color: neutral.gray900,
  },
  /** Screen title. Web: DashboardLayout `text-xl md:text-2xl font-bold`. */
  h1: {
    ...font('heading', weight.bold),
    fontSize: size.xl,
    lineHeight: lineHeight.xl,
    color: neutral.gray900,
  },
  /** Card title. Web: `text-xl font-bold text-gray-900`. */
  h2: {
    ...font('heading', weight.bold),
    fontSize: size.lg,
    lineHeight: lineHeight.lg,
    color: neutral.gray900,
  },
  /** Sub-section. Web: `text-sm font-bold` / `font-medium text-[#2F3437]`. */
  h3: {
    ...font('heading', weight.semibold),
    fontSize: size.base,
    lineHeight: lineHeight.base,
    color: neutral.gray900,
  },
  /** Emphasised running text. */
  bodyLg: {
    ...font('body', weight.regular),
    fontSize: size.base,
    lineHeight: lineHeight.base,
    color: brand.dark,
  },
  /** Default running text — the web's `text-sm`. */
  body: {
    ...font('body', weight.regular),
    fontSize: size.sm,
    lineHeight: lineHeight.sm,
    color: brand.dark,
  },
  /** Row labels, form labels. Web: `text-sm font-medium text-gray-700`. */
  label: {
    ...font('body', weight.semibold),
    fontSize: size.sm,
    lineHeight: lineHeight.sm,
    color: neutral.gray900,
  },
  /** Supporting copy. Web: `text-xs text-gray-500`. */
  caption: {
    ...font('body', weight.regular),
    fontSize: size.xs,
    lineHeight: lineHeight.xs,
    color: neutral.gray500,
  },
  /** The web's eyebrow: `text-[10px] font-bold uppercase tracking-widest`. */
  eyebrow: {
    ...font('body', weight.bold),
    fontSize: size.micro,
    lineHeight: lineHeight.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: neutral.gray400,
  },
  /** Button label. Web: `font-medium` at `text-sm`, or `font-bold` on the CTA. */
  button: {
    ...font('heading', weight.semibold),
    fontSize: size.sm,
    lineHeight: lineHeight.sm,
  },
  /** Count/level pills. Web: `text-xs font-semibold`. */
  badge: {
    ...font('body', weight.semibold),
    fontSize: size.xs,
    lineHeight: lineHeight.xs,
  },
}

/**
 * Which of the two families each role draws from. `components/ui/Text` needs
 * this to re-resolve the family when a call site asks for a different weight —
 * on Android the weight lives in the file name, so `font-bold` on a `heading`
 * role has to become `SpaceGrotesk-Bold`, not `SpaceGrotesk-Regular` plus a
 * synthesised bold.
 */
export const roleFamily = {
  hero: 'heading',
  display: 'heading',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  button: 'heading',
  bodyLg: 'body',
  body: 'body',
  label: 'body',
  caption: 'body',
  eyebrow: 'body',
  badge: 'body',
}

export default { font, weight, size, lineHeight, text, roleFamily, FONTS_LINKED }
