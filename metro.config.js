const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname)

config.resolver = {
  ...config.resolver,
  // @react-navigation v7 ships ESM only and relies on package exports.
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['react-native', 'require', 'import', 'default'],
}

const nativeWindConfig = withNativeWind(config, { input: './global.css' })

module.exports = nativeWindConfig

