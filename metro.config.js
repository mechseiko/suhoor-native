const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");
const { withNativeWind } = require("nativewind/metro");

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// Keep release bundling out of the shared Windows temp cache. Metro may fail to
// remove that cache when another Node process or antivirus scanner has a handle
// open on it.
config.cacheStores = [
  new FileStore({ root: path.join(__dirname, ".metro-cache") }),
];

config.resolver = {
  ...config.resolver,
  // @react-navigation v7 ships ESM only and relies on package exports.
  unstable_enablePackageExports: true,
  unstable_conditionNames: ["react-native", "require", "import", "default"],
  assetExts: [...config.resolver.assetExts, "svg"],
  sourceExts: [...config.resolver.sourceExts, "svg"],
};

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};

const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

module.exports = nativeWindConfig;
