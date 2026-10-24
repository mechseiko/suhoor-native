// expo-polyfill.js — DISABLED
// All expo package imports (expo-av, expo-font, @expo/vector-icons, expo-constants)
// have been replaced with bare React Native equivalents. This file is intentionally
// left empty so nothing tries to bootstrap a fake expo global, which was the
// original source of the one-month crash loop:
//
//   TypeError: Cannot read property 'NativeModule' of undefined
//   at expo-modules-core/build/NativeModule.js:3
//
// The crash happened because expo-modules-core's NativeModule.js evaluates:
//   export default globalThis.expo.NativeModule
// which requires expo's C++ JSI runtime to have already run — something bare
// React Native Android builds DO NOT do. The polyfill tried to set up a fake
// globalThis.expo in JS, but ESM module evaluation order meant that
// expo-modules-core was being resolved before the polyfill could run.
// Removing all expo package dependencies from user code is the only clean fix.
