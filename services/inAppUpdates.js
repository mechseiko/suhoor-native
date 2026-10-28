import { Platform, Linking } from 'react-native';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mechseiko.suhoor';

/**
 * Triggers Google Play In-App Updates in IMMEDIATE mode on Android.
 * If the user sideloaded the app, is on iOS, or Google Play Core API fails,
 * it seamlessly falls back to opening the store URL via Linking.
 *
 * @param {string} [fallbackUrl] Optional store URL fallback
 * @returns {Promise<boolean>} Whether the in-app update flow or fallback was initiated
 */
export const triggerImmediateUpdate = async (fallbackUrl = PLAY_STORE_URL) => {
  // 1. iOS / Web Fallback
  if (Platform.OS !== 'android') {
    if (fallbackUrl) {
      Linking.openURL(fallbackUrl).catch((err) => {
        console.warn('[InAppUpdates] Could not open store fallback:', err);
      });
    }
    return false;
  }

  try {
    // Dynamic import to avoid bundling issues on web
    const SpInAppUpdates = await import('sp-react-native-in-app-updates');
    const { IAUUpdateKind } = SpInAppUpdates;

    // Use true for internal testing/closed testing to allow updates from internal tracks
    // This enables in-app updates even when app is not in production
    const inAppUpdates = new SpInAppUpdates.default(true);

    const result = await inAppUpdates.checkNeedsUpdate();
    console.log('[InAppUpdates] checkNeedsUpdate result:', result);
    console.log('[InAppUpdates] shouldUpdate:', result?.shouldUpdate);
    console.log('[InAppUpdates] availableVersionCode:', result?.availableVersionCode);
    console.log('[InAppUpdates] clientVersionCode:', result?.clientVersionCode);

    if (result && result.shouldUpdate) {
      await inAppUpdates.startUpdate({
        updateType: IAUUpdateKind.IMMEDIATE, // Triggers full-screen blocking Google Play UI
      });
      return true;
    } else {
      console.log('[InAppUpdates] App is already up to date according to Play Core.');
      // If our custom version comparison detected an update, but Play Store cache hasn't propagated,
      // fall back to opening the store listing so the user isn't stuck.
      if (fallbackUrl) {
        await Linking.openURL(fallbackUrl).catch(() => {});
      }
      return false;
    }
  } catch (err) {
    console.warn('[InAppUpdates] Play Core in-app update failed, falling back to Play Store link:', err);
    // Sideloaded APK or Google Play Services not available fallback
    try {
      const targetUrl = fallbackUrl || PLAY_STORE_URL;
      await Linking.openURL(targetUrl);
    } catch (linkErr) {
      console.error('[InAppUpdates] Could not open Play Store URL:', linkErr);
    }
    return false;
  }
};

export default triggerImmediateUpdate;
