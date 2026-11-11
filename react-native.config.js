// React Native CLI project config.
//
// RN 0.76 registers both the android platform and the `bundle` / `start`
// commands in `react-native/react-native.config.js`. The app config replaces
// (not extends) that file, so its platforms and commands must be merged in.
// Without them: `rnc-cli config` reports `dependencies: {}` (autolinking links
// nothing) and the Gradle bundle task fails with `unknown command 'bundle'`.
const reactNativeConfig = require('react-native/react-native.config.js');

module.exports = {
  assets: ['./assets/fonts/'],
  platforms: reactNativeConfig.platforms,
  commands: reactNativeConfig.commands,
};
