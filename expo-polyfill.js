// Polyfill globalThis.expo for bare React Native (Android/iOS)
// where expo-modules-core native C++/JSI runtime is not linked.

const setupExpoPolyfill = () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : window;
  if (!g) return;

  if (!g.expo) {
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

    const expoPolyfill = {
      EventEmitter,
      NativeModule,
      SharedObject,
      modules: {
        NativeModulesProxy: {},
        ExpoFontLoader: {
          loadAsync: async () => {},
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
      },
      uuidv4: () => '',
      uuidv5: () => '',
      getViewConfig: () => ({}),
      reloadAppAsync: async () => {},
    };

    g.expo = expoPolyfill;
    if (typeof globalThis !== 'undefined') globalThis.expo = expoPolyfill;
    if (typeof global !== 'undefined') global.expo = expoPolyfill;
  } else {
    // If g.expo exists but is missing sub-properties
    if (!g.expo.EventEmitter) {
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
          this.listeners.get(eventName)?.forEach((l) => l(...args));
        }
        listenerCount(eventName) {
          return this.listeners.get(eventName)?.size ?? 0;
        }
      }
      g.expo.EventEmitter = EventEmitter;
    }

    if (!g.expo.NativeModule) {
      class NativeModule extends g.expo.EventEmitter {
        ViewPrototype = undefined;
        __expo_module_name__ = undefined;
      }
      g.expo.NativeModule = NativeModule;
    }

    if (!g.expo.SharedObject) {
      class SharedObject extends g.expo.EventEmitter {
        release() {}
      }
      g.expo.SharedObject = SharedObject;
    }

    if (!g.expo.modules) {
      g.expo.modules = {};
    }
    if (!g.expo.modules.ExpoFontLoader) {
      g.expo.modules.ExpoFontLoader = {
        loadAsync: async () => {},
      };
    }
    if (!g.expo.modules.ExponentAV) {
      g.expo.modules.ExponentAV = {
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
      };
    }
    if (!g.expo.getViewConfig) {
      g.expo.getViewConfig = () => ({});
    }
  }
};

setupExpoPolyfill();
