/**
 * Suhoor design tokens — the single source of truth for the native app.
 *
 * Every value here is lifted from the web app so the two products read as one
 * brand. The web side configures Tailwind v4 in CSS (`src/index.css`), so that
 * file's `@theme` block is the upstream for the brand colors and the two font
 * families; the greys and the radius/shadow scale come from the Tailwind
 * defaults the web components actually use (measured by frequency across
 * `src/**`, not guessed).
 *
 * Rule for new UI: import from here (or read the theme off `useTheme()`).
 * No literal hex codes, font sizes, radii, or spacing in screens.
 */

// ---------------------------------------------------------------------------
// Brand palette — src/index.css `@theme`
// ---------------------------------------------------------------------------

export const brand = {
  /** Deep indigo. `--color-primary`. Near-black; the web app fills buttons and
   *  the hero with it and uses it for link/icon accents. */
  primary: '#150C33',
  /** Warm amber. `--color-secondary`. The hero's CTA fill and the highlight
   *  color for streaks, levels and "special day" emphasis. */
  secondary: '#F9A826',
  /** Aqua mint. `--color-accent`. Success-ish affirmation (woke up, fasted). */
  accent: '#00C2A8',
  /** Soft gray. `--color-muted`. */
  muted: '#E5E7EB',
  /** Charcoal. `--color-dark` — the web `body` text color. */
  dark: '#1F2937',
}

/**
 * Text on top of a `brand.secondary` fill. The web hero CTA is
 * `bg-secondary text-[#150C33]` — amber never carries white text.
 */
export const onSecondary = brand.primary

// ---------------------------------------------------------------------------
// Neutrals — the Tailwind greys the web components lean on
// ---------------------------------------------------------------------------

export const neutral = {
  white: '#FFFFFF',
  gray50: '#F9FAFB', // page canvas behind cards (web: `bg-gray-50/30`)
  gray100: '#F3F4F6', // card borders + inert fills
  gray200: '#E5E7EB',
  gray400: '#9CA3AF', // de-emphasised meta text
  gray500: '#6B7280', // secondary text
  gray600: '#4B5563',
  gray900: '#111827', // headings
}

// ---------------------------------------------------------------------------
// Status colors — as used in the web app
// ---------------------------------------------------------------------------

export const status = {
  success: '#10B981',
  successDark: '#34D399',
  warning: brand.secondary,
  error: '#EF4444',
  errorDark: '#F87171',
}

// ---------------------------------------------------------------------------
// Alpha helper
// ---------------------------------------------------------------------------

/**
 * `alpha('#150C33', 0.1)` → `'#150C331A'`.
 *
 * The web app tints with Tailwind's slash syntax (`bg-primary/10`,
 * `border-primary/20`); this is the native equivalent. Prefer it over
 * hand-written 8-digit hex so the ratio stays readable at the call site.
 */
export const alpha = (hex, amount) => {
  const clamped = Math.max(0, Math.min(1, amount))
  const channel = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()
  return `${hex}${channel}`
}

// ---------------------------------------------------------------------------
// Spacing — 4pt grid. Web cards are `p-4`, page gutters `px-4`, stacks
// `space-y-6`.
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16, // the web's `p-4` / `gap-4` default
  lg: 20,
  xl: 24, // `space-y-6` between page sections
  xxl: 32,
  xxxl: 40,
}

// ---------------------------------------------------------------------------
// Radius — matches the Tailwind steps the web app uses, by frequency:
// rounded-xl (106) > rounded-lg (91) > rounded-full (86) > rounded-2xl (80)
// > rounded-3xl (28).
// ---------------------------------------------------------------------------

export const radius = {
  sm: 3,
  md: 4, // reduced by one level (was 6)
  lg: 6, // reduced by one level (was 8)
  xl: 8, // reduced by one level (was 12)
  xxl: 12, // reduced by one level (was 16; 3xl becomes 2xl)
  pill: 999,
}

// ---------------------------------------------------------------------------
// Elevation — the web is restrained: shadow-sm dominates (68 uses) and cards
// pair it with a `border-gray-100` hairline rather than a heavy drop shadow.
// Keep native shadows in that register; `lg` is for genuinely floating things
// (modals, the alarm overlay), not for cards.
// ---------------------------------------------------------------------------

export const elevation = {
  none: {},
  /** shadow-sm — a hint of lift under a bordered card. */
  sm: {
    shadowColor: brand.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  /** shadow-md — pressed/active affordances and sticky bars. */
  md: {
    shadowColor: brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  /** shadow-xl — modals, sheets, the alarm overlay card. */
  lg: {
    shadowColor: brand.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
}

export default {
  brand,
  onSecondary,
  neutral,
  status,
  alpha,
  spacing,
  radius,
  elevation,
}
