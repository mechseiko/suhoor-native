// Polyfill globalThis.expo for bare React Native (Android/iOS)
// where expo-modules-core native C++/JSI runtime is not linked.

const setupExpoPolyfill = () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : window;
  if (!g) return;

  // 1. Ensure NativeModules has EXNativeModulesProxy and ExponentConstants
  try {
    const RN = require('react-native');
    const NativeModules = RN.NativeModules || RN.default?.NativeModules;
    if (NativeModules) {
      if (!NativeModules.EXNativeModulesProxy) {
        NativeModules.EXNativeModulesProxy = {
          exportedMethods: {},
          viewManagersMetadata: {},
          modulesConstants: {},
        };
      }
      if (!NativeModules.ExponentConstants) {
        NativeModules.ExponentConstants = {
          appOwnership: 'standalone',
          executionEnvironment: 'standalone',
          expoVersion: '51.0.0',
          installationId: '',
          isDevice: true,
          manifest: {},
          nativeAppVersion: '1.0.11',
          nativeBuildVersion: '15',
          platform: { android: {} },
        };
      }
    }
  } catch (_) {}

  // 2. EventEmitter base class
  class EventEmitter {
    listeners = new Map();
    addListener(eventName, listener) {
      if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
      this.listeners.get(eventName).add(listener);
      return {
        remove: () => {
          this.listeners.get(eventName)?.delete(listener);
        },
      };
    }
    removeListener(eventName, listener) {
      this.listeners.get(eventName)?.delete(listener);
    }
    removeAllListeners(eventName) {
      this.listeners.get(eventName)?.clear();
    }
    emit(eventName, ...args) {
      this.listeners.get(eventName)?.forEach((l) => {
        try {
          l(...args);
        } catch (e) {
          console.warn('[Expo Polyfill] Error in listener:', e);
        }
      });
    }
    listenerCount(eventName) {
      return this.listeners.get(eventName)?.size ?? 0;
    }
  }

  class NativeModule extends EventEmitter {
    ViewPrototype = undefined;
    __expo_module_name__ = undefined;
  }

  class SharedObject extends EventEmitter {
    release() {}
  }

  // Helper to dynamically build a mock NativeModule for any module requested
  const createMockModule = (name) => {
    const mod = new NativeModule();
    mod.__expo_module_name__ = name;
    return new Proxy(mod, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'symbol') return undefined;
        // Return a safe async no-op function for any invoked method
        return async (...args) => {};
      },
    });
  };

  const baseModules = {
    NativeModulesProxy: {},
    ExpoFontLoader: {
      loadAsync: async () => {},
    },
    ExpoAsset: {
      downloadAsync: async (url) => url,
    },
    ExponentConstants: {
      name: 'ExponentConstants',
      appOwnership: 'standalone',
      executionEnvironment: 'standalone',
      expoVersion: '51.0.0',
      installationId: '',
      isDevice: true,
      manifest: {},
      nativeAppVersion: '1.0.11',
      nativeBuildVersion: '15',
      platform: { android: {} },
    },
    ExponentAV: {
      getStatusForSound: async () => ({ isLoaded: false }),
      loadForSound: async () => ({ isLoaded: false }),
      replaySound: async () => {},
      pauseForSound: async () => {},
      stopForSound: async () => {},
      unloadForSound: async () => {},
      setVolumeForSound: async () => {},
      setIsMutedForSound: async () => {},
      setIsLoopingForSound: async () => {},
      setAudioMode: async () => {},
    },
  };

  // Wrap with Proxy so requireNativeModule never throws "Cannot find native module"
  const modulesProxy = new Proxy(baseModules, {
    get(target, prop) {
      if (typeof prop === 'symbol') return target[prop];
      if (prop in target) return target[prop];
      target[prop] = createMockModule(String(prop));
      return target[prop];
    },
  });

  if (!g.expo) {
    const expoPolyfill = {
      EventEmitter,
      NativeModule,
      SharedObject,
      modules: modulesProxy,
      uuidv4: () => '',
      uuidv5: () => '',
      getViewConfig: () => ({}),
      reloadAppAsync: async () => {},
    };

    g.expo = expoPolyfill;
    if (typeof globalThis !== 'undefined') globalThis.expo = expoPolyfill;
    if (typeof global !== 'undefined') global.expo = expoPolyfill;
  } else {
    // If g.expo already exists, ensure EventEmitter, NativeModule, SharedObject and modules are populated
    if (!g.expo.EventEmitter) g.expo.EventEmitter = EventEmitter;
    if (!g.expo.NativeModule) g.expo.NativeModule = NativeModule;
    if (!g.expo.SharedObject) g.expo.SharedObject = SharedObject;
    if (!g.expo.getViewConfig) g.expo.getViewConfig = () => ({});

    if (!g.expo.modules) {
      g.expo.modules = modulesProxy;
    } else {
      // Merge base modules into existing g.expo.modules
      Object.assign(g.expo.modules, baseModules);
      // Wrap existing modules in Proxy if not already
      const existing = g.expo.modules;
      g.expo.modules = new Proxy(existing, {
        get(target, prop) {
          if (typeof prop === 'symbol') return target[prop];
          if (prop in target) return target[prop];
          target[prop] = createMockModule(String(prop));
          return target[prop];
        },
      });
    }
  }
};

setupExpoPolyfill();
