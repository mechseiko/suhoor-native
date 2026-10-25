/**
 * Shim for sp-react-native-in-app-updates on web platform.
 * This package only supports Android and iOS, so we provide a no-op implementation for web.
 */

// Mock the types/constants to match the package's exports
const IAUAvailabilityStatus = {
  NO_UPDATE: 0,
  UPDATE_AVAILABLE: 1,
  UNKNOWN: 2,
};

const IAUInstallStatus = {
  DOWNLOADED: 0,
  DOWNLOADING: 1,
  FAILED: 2,
  PENDING: 3,
  UNKNOWN: 4,
};

const IAUOther = {
  PLAY_STORE: 0,
};

const IAUUpdateKind = {
  FLEXIBLE: 0,
  IMMEDIATE: 1,
};

// No-op implementation matching the package's API
class InAppUpdates {
  constructor(isInternalTesting = false) {
    this.listeners = [];
    this.isInternalTesting = isInternalTesting;
  }

  checkNeedsUpdate() {
    return Promise.resolve({ shouldUpdate: false });
  }

  addStatusUpdateListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  removeStatusUpdateListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  startUpdate(options = {}) {
    return Promise.resolve();
  }

  performImmediateUpdate() {
    return Promise.resolve();
  }

  addSuccessListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  addFailureListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
}

const instance = new InAppUpdates();

module.exports = instance;
module.exports.IAUAvailabilityStatus = IAUAvailabilityStatus;
module.exports.IAUInstallStatus = IAUInstallStatus;
module.exports.IAUOther = IAUOther;
module.exports.IAUUpdateKind = IAUUpdateKind;
