/**
 * @deprecated Use `useTheme().colors` (mode-aware) or import tokens from
 * `../theme` directly. This module is a thin re-export kept so older imports
 * keep working; it is light-mode only and cannot follow the dark theme.
 *
 * It used to carry its own palette, which had drifted from the website — its
 * `primary` was `#3D1F94`, a violet that appears nowhere in `src/index.css`.
 * The values now come from `theme/tokens.js`, which mirrors the web app.
 */

import { brand, neutral, status } from '../theme/tokens';

export const Colors = {
  primary: brand.primary,
  secondary: brand.secondary,
  accent: brand.accent,
  heroBg: brand.primary,
  muted: brand.muted,
  dark: brand.dark,
  background: neutral.gray50,
  white: neutral.white,
  red: status.error,
  green: status.success,
  gray: neutral.gray500,
  lightGray: neutral.gray100,
};

export default Colors;
