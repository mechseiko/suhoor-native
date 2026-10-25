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
  // SAFETY NET: redirect expo-modules-core's NativeModule to a safe shim.
  // This project runs on bare React Native Android where Expo's C++ JSI runtime
  // (ExpoModulesCore native library) is NOT compiled into the APK.
  // Without this alias, any remaining transitive import of expo-modules-core
  // would crash with: TypeError: Cannot read property 'NativeModule' of undefined
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
  },
  resolveRequest: (context, moduleName, platform) => {
    // Intercept Platform on web where react-native's AssetSourceResolver looks for Utilities/Platform
    if (platform === "web") {
      if (
        moduleName === "../Utilities/Platform" ||
        moduleName.endsWith("Libraries/Utilities/Platform") ||
        moduleName.endsWith("Utilities/Platform")
      ) {
        return {
          filePath: require.resolve("react-native-web/dist/exports/Platform"),
          type: "sourceFile",
        };
      }

      // Intercept sp-react-native-in-app-updates on web (package doesn't support web)
      if (moduleName === "sp-react-native-in-app-updates") {
        return {
          filePath: path.resolve(__dirname, "shims/InAppUpdatesPackageShim/index.js"),
          type: "sourceFile",
        };
      }
    }

    // Intercept expo-modules-core on native platforms to prevent globalThis.expo crash
    if (
      platform !== "web" &&
      (moduleName === "expo-modules-core" ||
        moduleName.startsWith("expo-modules-core/") ||
        moduleName.endsWith("expo-modules-core/build/NativeModule"))
    ) {
      return {
        filePath: path.resolve(__dirname, "shims/ExpoNativeModuleShim.js"),
        type: "sourceFile",
      };
    }
    // Fall through to the default resolver for everything else
    return context.resolveRequest(context, moduleName, platform);
  },
};

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

const tailwindCliPath = path.resolve(__dirname, "node_modules/tailwindcss/lib/cli.js").replace(/\\/g, "/");
const nativeWindConfig = withNativeWind(config, {
  input: "./global.css",
  cliCommand: `node ${tailwindCliPath}`,
});

module.exports = nativeWindConfig;
