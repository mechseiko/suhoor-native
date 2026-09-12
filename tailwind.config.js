/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx}',
    './components/**/*.{js,jsx}',
    './navigation/**/*.{js,jsx}',
    './screens/**/*.{js,jsx}',
    './context/**/*.{js,jsx}',
    './hooks/**/*.{js,jsx}',
    './utils/**/*.{js,jsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#150C33',
        secondary: '#F9A826',
        accent: '#00C2A8',
        ink: '#1F2937',
        canvas: '#F9FAFB',
      },
      // Reduced border radius by one level (3xl -> 2xl level, etc.) to prevent over-rounded bubbling
      borderRadius: {
        '4xl': '16px',
        '3xl': '12px',
        '2xl': '8px',
        xl: '6px',
        lg: '4px',
        md: '3px',
      },
      // The web app's two families (src/index.css `--font-body` / `--font-heading`).
      // Android matches a family by file name, so each weight is its own entry —
      // there is no synthesising a SemiBold out of the Regular face. The .ttf
      // files are registered at startup by `theme/fonts.js`; see also
      // `theme/typography.js`, which resolves weight → face for the `Text` roles.
      fontFamily: {
        body: ['Quicksand-Regular'],
        'body-medium': ['Quicksand-Medium'],
        'body-semibold': ['Quicksand-SemiBold'],
        'body-bold': ['Quicksand-Bold'],
        heading: ['SpaceGrotesk-Regular'],
        'heading-medium': ['SpaceGrotesk-Medium'],
        'heading-semibold': ['SpaceGrotesk-SemiBold'],
        'heading-bold': ['SpaceGrotesk-Bold'],
      },
    },
  },
  plugins: [],
}
