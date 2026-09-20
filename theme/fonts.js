/**
 * The font binaries, keyed by the exact family name the rest of the app names.
 *
 * `global.css` declares these same eight faces with `@font-face`, but NativeWind
 * only honours `@font-face` on web — on Android and iOS the rules compile to
 * nothing. So the .ttf files sat in `assets/fonts/` unregistered, every
 * `fontFamily: 'Quicksand-Regular'` resolved to nothing, and React Native fell
 * back to the platform UI face without warning. Android registers the files from
 * `android/app/src/main/assets/fonts`.
 *
 * The keys must stay byte-identical to the names in `theme/typography.js` FAMILY
 * and in `tailwind.config.js` `fontFamily` — Android matches on the string.
 */
export const fontAssets = {
  "Quicksand-Regular": require("../assets/fonts/Quicksand-Regular.ttf"),
  "Quicksand-Medium": require("../assets/fonts/Quicksand-Medium.ttf"),
  "Quicksand-SemiBold": require("../assets/fonts/Quicksand-SemiBold.ttf"),
  "Quicksand-Bold": require("../assets/fonts/Quicksand-Bold.ttf"),
  "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk-Regular.ttf"),
  "SpaceGrotesk-Medium": require("../assets/fonts/SpaceGrotesk-Medium.ttf"),
  "SpaceGrotesk-SemiBold": require("../assets/fonts/SpaceGrotesk-SemiBold.ttf"),
  "SpaceGrotesk-Bold": require("../assets/fonts/SpaceGrotesk-Bold.ttf"),
};

export default fontAssets;
