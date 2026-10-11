// import 'react-native-get-random-values'

// // Polyfill globalThis.expo for bare React Native (Android/iOS) where expo-modules-core native runtime is not installed
// if (typeof globalThis !== 'undefined' && typeof globalThis.expo === 'undefined') {
//   class EventEmitter {
//     listeners = new Map()
//     addListener(eventName, listener) {
//       if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set())
//       this.listeners.get(eventName).add(listener)
//       return {
//         remove: () => {
//           this.listeners.get(eventName)?.delete(listener)
//         },
//       }
//     }
//     removeListener(eventName, listener) {
//       this.listeners.get(eventName)?.delete(listener)
//     }
//     removeAllListeners(eventName) {
//       this.listeners.get(eventName)?.clear()
//     }
//     emit(eventName, ...args) {
//       this.listeners.get(eventName)?.forEach(l => l(...args))
//     }
//     listenerCount(eventName) {
//       return this.listeners.get(eventName)?.size ?? 0
//     }
//   }

//   class NativeModule extends EventEmitter {
//     ViewPrototype = undefined
//     __expo_module_name__ = undefined
//   }

//   class SharedObject extends EventEmitter {
//     release() {}
//   }

//   globalThis.expo = {
//     EventEmitter,
//     NativeModule,
//     SharedObject,
//     modules: {
//       ExpoFontLoader: {
//         loadAsync: async () => {},
//       },
//       ExponentAV: {
//         getStatusForSound: async () => ({ isLoaded: false }),
//         loadForSound: async () => ({ isLoaded: false }),
//         replaySound: async () => {},
//         pauseForSound: async () => {},
//         stopForSound: async () => {},
//         unloadForSound: async () => {},
//         setVolumeForSound: async () => {},
//         setIsMutedForSound: async () => {},
//         setIsLoopingForSound: async () => {},
//         setAudioMode: async () => {},
//       },
//     },
//     uuidv4: () => '',
//     uuidv5: () => '',
//     getViewConfig: () => {},
//     reloadAppAsync: async () => {},
//   }
// }

// // Suppress react-native-web deprecation warnings immediately before any modules load
// if (typeof console !== 'undefined') {
//   const isIgnored = (...args) => {
//     const str = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ')
//     return (
//       str.includes('props.pointerEvents is deprecated') ||
//       str.includes('"shadow*" style props are deprecated') ||
//       (str.includes('pointerEvents') && str.includes('deprecated')) ||
//       (str.includes('shadow*') && str.includes('boxShadow'))
//     )
//   }

//   const origWarn = console.warn
//   console.warn = (...args) => {
//     if (isIgnored(...args)) return
//     origWarn(...args)
//   }

//   const origError = console.error
//   console.error = (...args) => {
//     if (isIgnored(...args)) return
//     origError(...args)
//   }
// }

// import './global.css'
// import { AppRegistry, Platform } from 'react-native'
// import App from './App'

// AppRegistry.registerComponent('main', () => App)

// if (Platform.OS === 'web' && typeof document !== 'undefined') {
//   const rootTag = document.getElementById('root') || document.getElementById('main')
//   if (rootTag) {
//     AppRegistry.runApplication('main', { rootTag })
//   }
// }

import 'react-native-get-random-values'

// Suppress react-native-web deprecation warnings immediately before any modules load
if (typeof console !== 'undefined') {
  const isIgnored = (...args) => {
    const str = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ')
    return (
      str.includes('props.pointerEvents is deprecated') ||
      str.includes('"shadow*" style props are deprecated') ||
      (str.includes('pointerEvents') && str.includes('deprecated')) ||
      (str.includes('shadow*') && str.includes('boxShadow'))
    )
  }

  const origWarn = console.warn
  console.warn = (...args) => {
    if (isIgnored(...args)) return
    origWarn(...args)
  }

  const origError = console.error
  console.error = (...args) => {
    if (isIgnored(...args)) return
    origError(...args)
  }
}

import './global.css'
import { AppRegistry, Platform } from 'react-native'
import App from './App'

AppRegistry.registerComponent('main', () => App)

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const rootTag = document.getElementById('root') || document.getElementById('main')
  if (rootTag) {
    AppRegistry.runApplication('main', { rootTag })
  }
}
