// Safe shim for expo-modules-core when running on bare React Native
// Prevents any crash from: TypeError: Cannot read property 'NativeModule' of undefined

class NativeModuleShim {
  __expo_module_name__ = undefined;
  ViewPrototype = undefined;

  addListener() { return { remove: () => {} }; }
  removeAllListeners() {}
  emit() {}
}

export class EventEmitter {
  addListener() { return { remove: () => {} }; }
  removeListener() {}
  removeAllListeners() {}
  emit() {}
}

export class SharedObject extends EventEmitter {
  release() {}
}

export const requireNativeModule = () => new NativeModuleShim();
export const requireOptionalNativeModule = () => null;
export const ensureNativeModulesAreInstalled = () => {};
export const CodedError = class extends Error {};
export const UnavailabilityError = class extends Error {};
export const Platform = { OS: 'android', select: (obj) => obj.android || obj.default };

export default NativeModuleShim;