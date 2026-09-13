/**
 * Babel configuration for the mobile app.
 *
 * This file did not exist, which is why Metro could not build the app at all:
 * without a preset there is nothing to transform JSX or Flow/TS syntax, so the
 * very first import of App.jsx failed.
 *
 * `react-native-dotenv` is what makes `.env` real here. Bare React Native has no
 * import.meta.env, and Metro only inlines `process.env.NODE_ENV` — every other
 * `process.env.X` read is `undefined` at runtime. config/firebase.js was reading
 * six `process.env.EXPO_PUBLIC_FIREBASE_*` values that were therefore all
 * undefined, so Firebase initialised with an empty config and auth failed on
 * launch. Values are now imported from the virtual `@env` module, which this
 * plugin fills in at build time from .env.
 *
 * Note: changes to .env are baked in at transform time. Restart Metro with
 * `npm start -- --reset-cache` after editing it, or the old values stay cached.
 */
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          // Missing variables come through as undefined instead of throwing at
          // build time, so a partially-filled .env still bundles and the app can
          // report which keys are absent.
          allowUndefined: true,
          safe: false,
        },
      ],
      'react-native-reanimated/plugin',
    ],
  }
}
